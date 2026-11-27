<?php

namespace Tests\Feature;

use App\Models\AuditEntry;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ShippingCity;
use App\Models\ShopOrder;
use App\Models\SystemConfig;
use App\Models\User;
use App\Payments\CmiProvider;
use App\Services\PaymentService;
use App\Support\PaymentStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Hybrid pricing + online checkout: exposure rules, server-side totals, payment methods, CMI, cart → quote. */
class CommerceFlowTest extends TestCase
{
    use RefreshDatabase;

    private const CART = 'abcdefghijklmnop1234';

    protected function setUp(): void
    {
        parent::setUp();
        ShippingCity::create(['slug' => 'casablanca', 'name' => 'Casablanca', 'fee' => 400, 'updatedAt' => now()]);
        ShippingCity::create(['slug' => 'rabat', 'name' => 'Rabat', 'fee' => 800, 'updatedAt' => now()]);
        Category::create(['slug' => 'portes-coupe-feu', 'label' => 'Portes coupe-feu', 'family' => 'portes-coupe-feu', 'updatedAt' => now()]);
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        Product::create(['id' => 'CF-SUR-MESURE', 'slug' => 'cf-sur-mesure', 'title' => 'Porte coupe-feu sur mesure', 'seoTitle' => 'Porte sur mesure', 'description' => 'Sur mesure à partir de 5 000 DH TTC', 'price' => 5000, 'category' => 'Portes coupe-feu', 'availability' => 'sur commande', 'active' => true, 'salesMode' => 'quote_only', 'updatedAt' => now()]);
    }

    private function showPrices(bool $on = true): void
    {
        SystemConfig::where('name', 'shop')->first()->saveForm(['showPrices' => $on]);
    }

    private function shop(array $fields): void
    {
        SystemConfig::where('name', 'shop')->first()->saveForm($fields);
    }

    private function order(array $extra = []): array
    {
        return ['name' => 'Société Test', 'phone' => '0612345678', 'email' => 'client@example.test', 'city' => 'Casablanca', 'pickup' => true,
            'items' => [['id' => 'CF-EI60-90', 'qty' => 1]], 'paymentMethod' => 'virement', 'cgv' => true, 'cartId' => self::CART, ...$extra];
    }

    private function enableCmi(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'super_admin']));
        SystemConfig::where('name', 'cmi')->first()->saveForm(['enabled' => true, 'merchantId' => '600000000', 'gatewayUrl' => 'https://testpayment.cmi.co.ma/fim/est3Dgate', 'merchantSecret' => 'synthetic-store-key']);
        auth()->logout();
    }

    public function test_price_mode_is_exposed_and_prices_never_leave_for_quote_products_or_when_hidden(): void
    {
        // Master switch off: everything in quote mode, no price at all.
        $rows = collect($this->getJson('/api/catalog')->assertOk()->json())->keyBy('id');
        $this->assertSame('quote', $rows['CF-EI60-90']['priceMode']);
        $this->assertArrayNotHasKey('price', $rows['CF-EI60-90']);
        $this->assertArrayNotHasKey('basePrice', $rows['CF-EI60-90']);

        $this->showPrices();
        Product::whereKey('CF-EI60-90')->first()->update(['maxOnlineQty' => 10]);
        $rows = collect($this->getJson('/api/catalog')->assertOk()->json())->keyBy('id');
        $this->assertSame('online', $rows['CF-EI60-90']['priceMode']);
        $this->assertSame(2200, $rows['CF-EI60-90']['price']);
        $this->assertSame(10, $rows['CF-EI60-90']['maxOnlineQty']);
        $this->assertSame(20, $rows['CF-EI60-90']['taxRate']);
        // « Sur devis » product: no price fields, price mentions removed from the texts, raw salesMode never sent.
        $quote = $rows['CF-SUR-MESURE'];
        $this->assertSame('quote', $quote['priceMode']);
        foreach (['price', 'basePrice', 'compareAt', 'promoName', 'salesMode'] as $k) {
            $this->assertArrayNotHasKey($k, $quote);
        }
        $this->assertStringNotContainsString('5 000', $quote['description']);
        $this->getJson('/api/products/cf-sur-mesure')->assertOk()->assertJsonMissingPath('price')->assertJsonPath('priceMode', 'quote');

        // « Prix à confirmer » also falls back to quote mode.
        Product::whereKey('CF-EI60-90')->first()->update(['priceToConfirm' => true]);
        $this->getJson('/api/products/cf-ei60-90')->assertJsonPath('priceMode', 'quote')->assertJsonMissingPath('price');
    }

    public function test_preview_recomputes_totals_on_the_server_with_ht_tva_shipping_and_coupon(): void
    {
        $preview = ['items' => [['id' => 'CF-EI60-90', 'qty' => 2]], 'deliveryMode' => 'casablanca', 'coupon' => 'PRO10'];
        $this->postJson('/api/shop/checkout/preview', $preview)->assertOk()->assertJsonPath('pricesHidden', true)->assertJsonMissingPath('totalTtc')->assertJsonMissingPath('items.0.unitTtc');

        $this->showPrices();
        Coupon::create(['code' => 'PRO10', 'kind' => 'percent', 'value' => 10, 'minOrder' => 1000, 'usageLimit' => 5, 'active' => true]);
        $r = $this->postJson('/api/shop/checkout/preview', $preview)->assertOk()
            ->assertJsonPath('subtotalTtc', 4400)->assertJsonPath('discount', 440)->assertJsonPath('coupon', 'PRO10')
            ->assertJsonPath('shipping.fee', 400)->assertJsonPath('totalTtc', 4360)->assertJsonPath('deliveryMode', 'casablanca')
            ->assertJsonPath('items.0.unitTtc', 2200)->assertJsonPath('quoteRequired', false);
        $this->assertEqualsWithDelta(3633.33, $r->json('totalHt'), 0.01);
        $this->assertEqualsWithDelta(726.67, $r->json('tva'), 0.01);
        $this->assertSame(['virement', 'reception'], array_column($r->json('payments'), 'key'), 'CMI is not offered while disabled');
        $this->assertDatabaseHas('Coupon', ['code' => 'PRO10', 'usedCount' => 0]);

        $this->postJson('/api/shop/checkout/preview', [...$preview, 'coupon' => 'NOPE'])->assertOk()->assertJsonPath('discount', 0)->assertJsonPath('couponError', 'Code promo invalide, expiré ou épuisé.');
        // A quote-only line or a quantity above the online limit asks for a quote, without amounts.
        Product::whereKey('CF-EI60-90')->first()->update(['maxOnlineQty' => 1]);
        $this->postJson('/api/shop/checkout/preview', $preview)->assertOk()->assertJsonPath('blockers.0.reason', 'over_max')->assertJsonPath('blockers.0.max', 1);
        $this->postJson('/api/shop/checkout/preview', ['items' => [['id' => 'CF-SUR-MESURE', 'qty' => 1]]])->assertOk()
            ->assertJsonPath('quoteRequired', true)->assertJsonPath('totalTtc', null)->assertJsonPath('items.0.unitTtc', null)->assertJsonPath('payments', []);
    }

    public function test_bank_transfer_order_is_priced_on_server_audited_mailed_and_proof_is_verified_by_finance(): void
    {
        Storage::fake('local');
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'test-message'], 200)]);
        $this->shop(['showPrices' => true, 'bankRib' => '011 780 0000 1234 5678 9012 34', 'bankHolder' => 'FAW ALUMINIUM SARL']);
        DB::table('Cart')->insert(['id' => self::CART, 'items' => '[]', 'itemCount' => 1, 'subtotal' => 2200, 'createdAt' => now()->getTimestampMs(), 'updatedAt' => now()->getTimestampMs()]);

        $number = $this->postJson('/api/orders', $this->order(['total' => 1, 'subtotal' => 1, 'items' => [['id' => 'CF-EI60-90', 'qty' => 2]], 'pickup' => false, 'deliveryMode' => 'casablanca', 'address' => '12 bd Zerktouni', 'company' => 'Atelier Test', 'ice' => '001234567000089', 'clientType' => 'entreprise']))
            ->assertCreated()->assertJsonPath('paymentMethod', 'virement')->json('number');
        $o = ShopOrder::where('number', $number)->firstOrFail();
        $this->assertSame([4400, 400, 4800, 'en_attente', 'nouveau', 'casablanca', 'entreprise'], [(int) $o->subtotal, (int) $o->deliveryFee, (int) $o->total, $o->paymentStatus, $o->status, $o->citySlug, $o->clientType]);
        $this->assertTrue($o->cgvAccepted);
        $p = Payment::where('shop_order_id', $o->id)->firstOrFail();
        $this->assertSame(['bank_transfer', 4800, PaymentStatus::Awaiting], [$p->provider, (int) $p->amount, $p->status]);
        $this->assertStringNotContainsString(substr($number, 11), $p->reference, 'the public payment reference never reveals the private order number');
        $this->assertDatabaseHas('LeadEvent', ['orderId' => $o->id, 'toStatus' => 'nouveau']);
        $this->assertDatabaseHas('Cart', ['id' => self::CART, 'status' => 'récupéré']);
        $this->assertTrue(AuditEntry::where('entity', 'Order')->where('entityId', (string) $o->id)->where('actor', 'site')->exists());
        Http::assertSentCount(2); // customer + team
        Http::assertSent(fn ($req) => $req['to'] === ['client@example.test'] && str_contains($req['text'], '011780000012345678901234') && str_contains($req['text'], '4 800,00 MAD'));

        // Confirmation page data: bank details, proof allowed, HT/TVA.
        $this->getJson('/api/shop/orders/'.$number)->assertOk()->assertJsonPath('payment.bank.rib', '011780000012345678901234')
            ->assertJsonPath('payment.canUploadProof', true)->assertJsonPath('payment.reference', $p->reference)->assertJsonPath('totalHt', 4000)->assertJsonPath('tva', 800);

        $pdf = tempnam(sys_get_temp_dir(), 'proof');
        file_put_contents($pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
        $this->post('/api/shop/orders/'.$number.'/proof', ['proof' => new UploadedFile($pdf, 'virement.pdf', 'application/pdf', null, true)])->assertOk()->assertJsonPath('code', 'proof_saved');
        $this->assertSame('en_verification', $o->fresh()->paymentStatus);
        $this->post('/api/shop/orders/'.$number.'/proof', ['proof' => new UploadedFile($pdf, 'virement.pdf', 'application/pdf', null, true)])->assertStatus(422);
        $this->post('/api/shop/orders/FAW-000000-'.str_repeat('A', 32).'/proof')->assertNotFound();

        app(PaymentService::class)->confirm($p->fresh(), User::factory()->create(['role' => 'finance_manager']), 'Virement reçu');
        $this->assertSame(['paye', 'confirmé'], [$o->fresh()->paymentStatus, $o->fresh()->status]);
        $this->assertDatabaseHas('LeadEvent', ['orderId' => $o->id, 'fromStatus' => 'nouveau', 'toStatus' => 'confirmé']);
    }

    public function test_cash_on_delivery_respects_enable_switch_max_amount_and_cities(): void
    {
        $this->showPrices();
        $this->postJson('/api/orders', $this->order(['paymentMethod' => 'reception']))->assertCreated();
        $o = ShopOrder::latest('id')->firstOrFail();
        $this->assertSame(['reception', 'a_la_livraison'], [$o->paymentMethod, $o->paymentStatus]);
        $this->assertSame('cash_on_delivery', Payment::where('shop_order_id', $o->id)->value('provider'));
        $this->getJson('/api/shop/orders/'.$o->number)->assertOk()->assertJsonPath('payment.canUploadProof', false)->assertJsonPath('payment.bank', null);

        $this->shop(['codMaxAmount' => 2000]);
        $this->postJson('/api/orders', $this->order(['paymentMethod' => 'reception']))->assertUnprocessable()->assertJsonValidationErrors('paymentMethod');
        $this->postJson('/api/shop/checkout/preview', ['items' => [['id' => 'CF-EI60-90', 'qty' => 1]], 'pickup' => true])->assertJsonPath('payments.1.key', 'reception')->assertJsonPath('payments.1.available', false)->assertJsonPath('payments.1.reason', 'cod_max');

        $this->shop(['codMaxAmount' => null, 'codCities' => ['casablanca']]);
        $delivery = ['pickup' => false, 'address' => 'Avenue Mohammed V, Rabat', 'paymentMethod' => 'reception'];
        $this->postJson('/api/orders', $this->order([...$delivery, 'deliveryMode' => 'rabat']))->assertUnprocessable()->assertJsonValidationErrors('paymentMethod');
        $this->postJson('/api/orders', $this->order([...$delivery, 'deliveryMode' => 'casablanca']))->assertCreated();
        $this->postJson('/api/orders', $this->order(['paymentMethod' => 'reception']))->assertCreated(); // pickup always allowed

        $this->shop(['codEnabled' => false, 'bankTransferEnabled' => false]);
        $this->postJson('/api/orders', $this->order(['paymentMethod' => 'reception']))->assertUnprocessable();
        $this->postJson('/api/orders', $this->order())->assertUnprocessable();
    }

    public function test_cmi_is_hidden_until_the_owner_enables_it_with_credentials_and_only_the_signed_callback_confirms(): void
    {
        $this->showPrices();
        // Not offered, not usable, and a technical admin cannot switch it on.
        $this->postJson('/api/orders', $this->order(['paymentMethod' => 'carte']))->assertUnprocessable();
        $this->actingAs(User::factory()->create(['role' => 'technical_admin']));
        SystemConfig::where('name', 'cmi')->first()->saveForm(['enabled' => true, 'merchantId' => '600000000', 'gatewayUrl' => 'https://testpayment.cmi.co.ma/fim/est3Dgate', 'merchantSecret' => 'synthetic-store-key']);
        $this->assertFalse(SystemConfig::settings('cmi')['enabled']);
        auth()->logout();
        // Owner without complete credentials: still off.
        $this->actingAs(User::factory()->create(['role' => 'super_admin']));
        SystemConfig::where('name', 'cmi')->first()->saveForm(['enabled' => true, 'gatewayUrl' => '']);
        $this->assertFalse(SystemConfig::settings('cmi')['enabled']);
        auth()->logout();

        $this->enableCmi();
        $this->postJson('/api/shop/checkout/preview', ['items' => [['id' => 'CF-EI60-90', 'qty' => 1]], 'pickup' => true])->assertJsonPath('payments.2.key', 'carte');
        $number = $this->postJson('/api/orders', $this->order(['paymentMethod' => 'carte']))->assertCreated()->json('number');
        $p = Payment::where('provider', 'cmi')->firstOrFail();
        $form = $this->getJson('/api/shop/orders/'.$number.'/cmi')->assertOk()->assertJsonPath('action', 'https://testpayment.cmi.co.ma/fim/est3Dgate')
            ->assertJsonPath('fields.amount', '2200.00')->assertJsonPath('fields.oid', $p->reference)->assertJsonPath('fields.currency', '504')->json('fields');
        $this->assertTrue(CmiProvider::verify($form, 'synthetic-store-key'));
        $this->assertStringNotContainsString('synthetic-store-key', json_encode($form));

        // The browser return changes nothing.
        $this->post('/api/payments/cmi/return/ok', ['oid' => $p->reference])->assertStatus(303)->assertRedirectContains('/commande/confirmation/'.$number);
        $this->assertSame(PaymentStatus::Awaiting, $p->fresh()->status);

        $callback = ['oid' => $p->reference, 'amount' => '2200.00', 'currency' => '504', 'ProcReturnCode' => '00', 'Response' => 'Approved', 'TransId' => 'T-1', 'clientid' => '600000000'];
        $this->call('POST', '/api/payments/cmi/callback', [...$callback, 'HASH' => 'forged'])->assertSee('FAILURE');
        $this->call('POST', '/api/payments/cmi/callback', [...$callback, 'amount' => '1.00', 'HASH' => CmiProvider::hash([...$callback, 'amount' => '1.00'], 'synthetic-store-key')])->assertSee('APPROVED');
        $this->assertSame(PaymentStatus::Awaiting, $p->fresh()->status);
        $signed = [...$callback, 'TransId' => 'T-2', 'HASH' => CmiProvider::hash([...$callback, 'TransId' => 'T-2'], 'synthetic-store-key')];
        $this->call('POST', '/api/payments/cmi/callback', $signed)->assertSee('ACTION=POSTAUTH');
        $this->call('POST', '/api/payments/cmi/callback', $signed)->assertSee('ACTION=POSTAUTH'); // replay: idempotent
        $this->assertSame(PaymentStatus::Confirmed, $p->fresh()->status);
        $this->assertSame('paye', ShopOrder::where('number', $number)->value('paymentStatus'));
        $this->getJson('/api/shop/orders/'.$number.'/cmi')->assertStatus(409);
    }

    public function test_quote_only_and_over_limit_carts_are_refused_online_and_converted_to_a_quote(): void
    {
        $this->showPrices();
        $this->postJson('/api/orders', $this->order(['items' => [['id' => 'CF-SUR-MESURE', 'qty' => 1]]]))->assertUnprocessable()->assertJsonValidationErrors('items');
        Product::whereKey('CF-EI60-90')->first()->update(['maxOnlineQty' => 5]);
        $this->postJson('/api/orders', $this->order(['items' => [['id' => 'CF-EI60-90', 'qty' => 6]]]))->assertUnprocessable()->assertJsonValidationErrors('items');
        $this->assertDatabaseCount('Order', 0);

        DB::table('Cart')->insert(['id' => self::CART, 'items' => '[]', 'itemCount' => 7, 'subtotal' => 0, 'createdAt' => now()->getTimestampMs(), 'updatedAt' => now()->getTimestampMs()]);
        $token = $this->postJson('/api/quotes', ['name' => 'Société Test', 'phone' => '0612345678', 'email' => 'client@example.test', 'city' => 'Casablanca', 'pickup' => true, 'cartId' => self::CART, 'fromCart' => true,
            'items' => [['id' => 'CF-EI60-90', 'qty' => 6], ['id' => 'CF-SUR-MESURE', 'qty' => 1]]])->assertCreated()->assertJsonPath('status', 'à valider')->json('token');
        $this->assertMatchesRegularExpression('/^[\w-]{32}$/', $token);
        $this->assertDatabaseHas('Cart', ['id' => self::CART, 'status' => 'devis']);
        $this->getJson('/api/shop/quotes/'.$token)->assertOk()->assertJsonPath('lines.0.qty', 6)->assertJsonPath('ready', false)->assertJsonMissingPath('lines.0.unit');
    }

    public function test_orders_need_cgv_and_a_moroccan_phone(): void
    {
        $this->showPrices();
        $this->postJson('/api/orders', $this->order(['cgv' => false]))->assertUnprocessable()->assertJsonValidationErrors('cgv');
        $this->postJson('/api/orders', $this->order(['phone' => '0112345678']))->assertUnprocessable()->assertJsonValidationErrors('phone');
        $this->postJson('/api/orders', $this->order(['phone' => '+212 6 12 34 56 78', 'ice' => '001 234 567 000 089', 'clientType' => 'entreprise', 'company' => 'Atelier']))->assertCreated();
        $this->assertDatabaseHas('Order', ['phone' => '+212612345678', 'ice' => '001234567000089']);
    }
}
