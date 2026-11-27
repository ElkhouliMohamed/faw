<?php

namespace Tests\Feature;

use App\Filament\Resources\Bundles\BundleResource;
use App\Filament\Resources\Bundles\Pages\CreateBundle;
use App\Filament\Resources\Carts\CartResource;
use App\Filament\Resources\Categorys\Pages\CreateCategory;
use App\Filament\Resources\Products\Pages\CreateProduct;
use App\Filament\Resources\Products\Pages\EditProduct;
use App\Filament\Resources\Products\ProductResource;
use App\Filament\Resources\Promotions\PromotionResource;
use App\Filament\Resources\Users\Pages\EditUser;
use App\Filament\Widgets\CitySales;
use App\Filament\Widgets\DailySales;
use App\Filament\Widgets\Funnel;
use App\Filament\Widgets\ProductSales;
use App\Filament\Widgets\TrafficSources;
use App\Models\Attribute;
use App\Models\Badge;
use App\Models\Bundle;
use App\Models\Cart;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\FeeRule;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Quote;
use App\Models\Redirect;
use App\Models\ShippingCity;
use App\Models\SystemConfig;
use App\Models\User;
use App\Models\Warranty;
use App\Services\AnalyticsQueries;
use App\Services\QuoteService;
use Carbon\CarbonImmutable;
use Filament\Auth\Pages\Login;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\TestCase;

class ShopTest extends TestCase
{
    use RefreshDatabase;

    protected string $dir;

    protected string $rawToken = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->dir = '/tmp/faw-laravel-test-'.bin2hex(random_bytes(6));
        foreach (['devis', 'produits', 'out'] as $d) {
            mkdir($this->dir.'/'.$d, 0700, true);
        }
        foreach (['generer_devis.py', 'prochain_numero.py', 'logo-faw.jpeg'] as $f) {
            copy(base_path('tools/devis/'.$f), $this->dir.'/devis/'.$f);
        }
        copy(base_path('tests/fixtures/produits/produits-reference.csv'), $this->dir.'/produits/produits-reference.csv');
        file_put_contents($this->dir.'/devis/compteur-devis.txt', '9000');
        file_put_contents($this->dir.'/devis/journal-devis.csv', "numero,date,4_derniers,nom_utilise,produits,total_ttc,ville,remarque\n");
        config(['faw.generator' => $this->dir.'/devis/generer_devis.py', 'faw.counter' => $this->dir.'/devis/prochain_numero.py', 'faw.journal' => $this->dir.'/devis/journal-devis.csv', 'faw.output' => $this->dir.'/out', 'faw.resend_key' => null, 'faw.email_from' => null, 'faw.email_reply_to' => null]);
        ShippingCity::create(['slug' => 'casablanca', 'name' => 'Casablanca', 'fee' => 400, 'updatedAt' => now()]);
        ShippingCity::create(['slug' => 'rabat', 'name' => 'Rabat', 'fee' => 800, 'updatedAt' => now()]);
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'updatedAt' => now()]);
        Category::create(['slug' => 'portes-coupe-feu', 'label' => 'Portes coupe-feu', 'family' => 'portes-coupe-feu', 'updatedAt' => now()]);
    }

    protected function tearDown(): void
    {
        if (isset($this->dir)) {
            File::deleteDirectory($this->dir);
        }parent::tearDown();
    }


    protected function showPublicPrices(): void
    {
        SystemConfig::where('name', 'shop')->first()->saveForm(['showPrices' => true]);
    }

    protected function payload(): array
    {
        return ['name' => 'Client test local', 'phone' => '0612345678', 'email' => 'delivered@resend.dev', 'city' => 'Casablanca', 'pickup' => true, 'items' => [['id' => 'CF-EI60-90', 'qty' => 1]]];
    }

    protected function pending(): Quote
    {
        $this->rawToken = $this->postJson('/api/quotes', $this->payload())->assertCreated()->assertJsonPath('status', 'à valider')->json('token');

        return Quote::firstOrFail();
    }

    public function test_public_catalog_and_details_exclude_internal_data(): void
    {
        $this->getJson('/api/catalog')->assertOk()->assertJsonPath('0.id', 'CF-EI60-90')->assertJsonMissingPath('0.stockNoteInternal')->assertJsonMissingPath('0.price')->assertJsonMissingPath('0.basePrice')->assertJsonMissingPath('0.compareAt')->assertJsonPath('0.orderable', true);
        $this->getJson('/api/products/cf-ei60-90')->assertOk()->assertJsonMissingPath('price');
        $this->showPublicPrices();
        $this->getJson('/api/products/cf-ei60-90')->assertOk()->assertJsonPath('price', 2200);
        Product::first()->update(['active' => false]);
        $this->getJson('/api/catalog')->assertExactJson([]);
        $this->getJson('/api/products/cf-ei60-90')->assertNotFound();
    }

    public function test_quote_submission_pending_no_number_pdf_or_counter_reservation(): void
    {
        $q = $this->pending();
        $this->assertNull($q->number);
        $this->assertNull($q->pdfFile);
        $this->assertEquals('9000', file_get_contents($this->dir.'/devis/compteur-devis.txt'));
        $this->getJson('/api/quotes/'.$this->rawToken)->assertOk()->assertJsonPath('number', null)->assertJsonPath('pdf', null)->assertJsonMissingPath('phone')->assertJsonMissingPath('totalTtc');
        $this->get('/api/quotes/'.$this->rawToken.'/pdf')->assertNotFound();
    }

    public function test_team_validation_only_reserves_isolated_counter_and_unlocks_pdf(): void
    {
        $q = $this->pending();
        $message = app(QuoteService::class)->validate($q);
        $q->refresh();
        $this->assertEquals('9001', $q->number);
        $this->assertEquals('validé', $q->status);
        $this->assertStringContainsString('désactivé', $message);
        $this->assertFileExists($this->dir.'/out/'.$q->pdfFile);
        $this->get('/api/quotes/'.$this->rawToken.'/pdf')->assertOk();
        $this->assertCount(1, file($this->dir.'/devis/journal-devis.csv'));
        try {
            app(QuoteService::class)->validate($q);
        } catch (ValidationException) {
        }$this->assertEquals('9001', file_get_contents($this->dir.'/devis/compteur-devis.txt'));
    }

    public function test_risky_quotes_are_visible_pending_and_block_validation(): void
    {
        $this->postJson('/api/quotes', [...$this->payload(), 'note' => 'Demande de remise'])->assertCreated();
        $q = Quote::first();
        $this->assertNotEmpty($q->reviewReasons);
        $this->expectException(ValidationException::class);
        app(QuoteService::class)->validate($q);
    }

    public function test_orders_are_priced_on_server_and_cards_rejected(): void
    {
        $this->postJson('/api/orders', [...$this->payload(), 'paymentMethod' => 'cmi'])->assertUnprocessable();
        $this->postJson('/api/orders', [...$this->payload(), 'paymentMethod' => 'virement', 'total' => 1])->assertCreated();
        $this->assertDatabaseHas('Order', ['total' => 2200, 'status' => 'nouveau']);
    }

    public function test_admin_requires_session_and_owner_resources_render(): void
    {
        foreach (['/admin', '/admin/products', '/admin/quotes', '/admin/customers', '/admin/settings', '/admin/users'] as $url) {
            $this->get($url)->assertRedirect('/admin/login');
        }
        $this->get('/admin/login')->assertOk();
        $user = User::factory()->create(['role' => 'admin']);
        $this->actingAs($user);
        foreach (['/admin', '/admin/products', '/admin/quotes', '/admin/customers', '/admin/settings', '/admin/users', '/admin/shop-orders'] as $url) {
            $this->get($url)->assertOk();
        }
    }

    public function test_filament_product_edit_updates_catalog_and_is_audited(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        Livewire::test(EditProduct::class, ['record' => Product::first()->getKey()])->fillForm(['title' => 'Porte coupe-feu EI60 90 cm mise à jour', 'price' => 2250])->call('save')->assertHasNoFormErrors();
        $this->showPublicPrices();
        $this->getJson('/api/catalog')->assertJsonPath('0.price', 2250);
        $this->assertDatabaseHas('AuditLog', ['action' => 'updated', 'entity' => 'Product']);
    }

    public function test_viewer_cannot_mutate_catalog_or_manage_users(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        $this->assertFalse(ProductResource::canEdit(Product::first()));
        $this->assertFalse(ProductResource::canCreate());
        $this->get('/admin/users')->assertForbidden();
    }

    public function test_email_and_journal_only_after_successful_delivery(): void
    {
        $q = $this->pending();
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
        Http::preventStrayRequests();
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'test-message'], 200)]);
        app(QuoteService::class)->validate($q);
        $q->refresh();
        $this->assertEquals('envoyé', $q->status);
        $this->assertTrue($q->journaled);
        $rows = file($this->dir.'/devis/journal-devis.csv');
        $this->assertCount(2, $rows);
        $this->assertStringContainsString('site', $rows[1]);
        app(QuoteService::class)->sendEmail($q);
        $this->assertCount(2, file($this->dir.'/devis/journal-devis.csv'));
        Http::assertSentCount(1);
        $pdf = $this->dir.'/out/'.$q->pdfFile;
        Http::assertSent(function ($request) use ($q, $pdf) {
            $bodies = ($request['text'] ?? '').($request['html'] ?? '').($request['subject'] ?? '');
            $atts = $request['attachments'] ?? [];
            $pdfAtt = collect($atts)->firstWhere('filename', $q->pdfFile);
            $logoAtt = collect($atts)->firstWhere('filename', 'logo-faw.png');
            return $request['to'] === ['delivered@resend.dev']
                && $pdfAtt && $pdfAtt['content'] === base64_encode(file_get_contents($pdf))
                && $logoAtt && $logoAtt['content_id'] === 'logo-faw' && ! empty($logoAtt['content'])
                && ! preg_match('/https?:\/\/|www\.|href\s*=|mailto:|tel:|devis\/suivi|devis\/pdf|localhost|127\.0\.0\.1/i', $bodies)
                && str_contains($request['html'], 'cid:logo-faw')
                && str_contains($request['text'], 'ci-joint')
                && str_contains($request['html'], 'ci-joint')
                && str_contains($bodies, '+212 522 865 202')
                && str_contains($bodies, '21 Rue Al Yazidi Mohamed, Casablanca')
                && str_contains($bodies, 'Walid')
                && str_contains($bodies, 'Service commercial — FAW Aluminium');
        });
    }

    public function test_resend_failure_does_not_block_quote_validation_or_write_the_journal(): void
    {
        $q = $this->pending();
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW Aluminium <devis@faw.ma>', 'faw.email_reply_to' => 'faw@faw.ma']);
        Http::preventStrayRequests();
        Http::fake(['api.resend.com/*' => Http::response(['statusCode' => 403, 'name' => 'validation_error', 'message' => 'The faw.ma domain is not verified. Please, add and verify your domain on https://resend.com/domains'], 403)]);
        $message = app(QuoteService::class)->validate($q);
        $q->refresh();
        $this->assertEquals('9001', $q->number);
        $this->assertEquals('validé', $q->status);
        $this->assertEquals('échec', $q->emailStatus);
        $this->assertFalse((bool) $q->journaled);
        $this->assertCount(1, file($this->dir.'/devis/journal-devis.csv'));
        $this->assertStringContainsString('email non envoyé', $message);
        $this->assertStringContainsString('domaine', $message);
        Http::assertSent(function ($request) use ($q) {
            $bodies = ($request['text'] ?? '').($request['html'] ?? '').($request['subject'] ?? '');
            $atts = $request['attachments'] ?? [];
            $pdfAtt = collect($atts)->firstWhere('filename', $q->pdfFile);
            return $request['from'] === 'FAW Aluminium <devis@faw.ma>'
                && $request['reply_to'] === 'faw@faw.ma'
                && $request['to'] === ['delivered@resend.dev']
                && $pdfAtt && ! empty($pdfAtt['content'])
                && ! preg_match('/https?:\/\/|www\.|href\s*=|mailto:|tel:|devis\/suivi|devis\/pdf|localhost|127\.0\.0\.1/i', $bodies);
        });
    }

    public function test_quote_email_signature_uses_the_back_office_user_name(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin', 'name' => 'Karim']));
        $q = $this->pending();
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'test-message'], 200)]);
        app(QuoteService::class)->validate($q);
        Http::assertSent(function ($request) {
            $bodies = ($request['text'] ?? '').($request['html'] ?? '');
            return str_contains($bodies, 'Karim')
                && str_contains($bodies, 'Service commercial — FAW Aluminium')
                && ! str_contains($bodies, 'Walid');
        });
    }

    public function test_filament_login_and_user_edit_do_not_rehash_an_unchanged_password(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'password' => Hash::make('local-test-only-password')]);
        Livewire::test(Login::class)->fillForm(['email' => $user->email, 'password' => 'local-test-only-password'])->call('authenticate')->assertHasNoFormErrors();
        $this->assertAuthenticatedAs($user);
        Livewire::test(EditUser::class, ['record' => $user->getRouteKey()])->fillForm(['name' => 'Propriétaire test'])->call('save')->assertHasNoFormErrors();
        $this->assertTrue(Hash::check('local-test-only-password', $user->fresh()->password));
    }

    public function test_order_transport_is_charged_once_and_reception_is_kit_only(): void
    {
        $this->postJson('/api/orders', [...$this->payload(), 'pickup' => false, 'deliveryMode' => 'casablanca', 'address' => 'Adresse de test locale', 'paymentMethod' => 'virement'])->assertCreated();
        $this->assertDatabaseHas('Order', ['subtotal' => 2200, 'deliveryFee' => 400, 'total' => 2600]);
        $this->postJson('/api/orders', [...$this->payload(), 'paymentMethod' => 'reception'])->assertUnprocessable();
    }

    public function test_crud_product_and_category_creation(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        Livewire::test(CreateProduct::class)->fillForm(['id' => 'TEST-PRODUCT', 'slug' => 'test-product', 'title' => 'Produit de test', 'description' => 'Illustration non contractuelle', 'category' => 'Portes coupe-feu', 'price' => 100, 'availability' => 'en stock', 'active' => true])->call('create')->assertHasNoFormErrors();
        $this->assertDatabaseHas('Product', ['id' => 'TEST-PRODUCT', 'price' => 100]);
        Livewire::test(CreateCategory::class)->fillForm(['slug' => 'test-categorie', 'label' => 'Catégorie de test', 'family' => 'incendie', 'active' => true])->call('create')->assertHasNoFormErrors();
        $this->getJson('/api/categories')->assertJsonFragment(['slug' => 'test-categorie']);
    }

    public function test_imported_prisma_millisecond_dates_render_in_filament(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $q = $this->pending();
        DB::table('Quote')->where('id', $q->id)->update(['createdAt' => 1762000000000]);
        DB::table('Order')->where('id', $q->orderId)->update(['createdAt' => 1762000000000]);
        $this->assertInstanceOf(CarbonImmutable::class, $q->fresh()->createdAt);
        $this->get('/admin/quotes')->assertOk()->assertSee('Client test local')->assertSee('à valider');
        $this->get('/admin/shop-orders')->assertOk();
    }

    public function test_journal_retry_after_a_crash_does_not_append_a_duplicate_row(): void
    {
        $q = $this->pending();
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'test-message'], 200)]);
        app(QuoteService::class)->validate($q);
        $q->refresh();
        $q->update(['journaled' => false, 'status' => 'validé']);
        app(QuoteService::class)->sendEmail($q->fresh());
        $this->assertCount(2, file($this->dir.'/devis/journal-devis.csv'));
        $this->assertTrue($q->fresh()->journaled);
        $this->assertEquals('envoyé', $q->fresh()->status);
        Http::assertSentCount(1);
    }

    public function test_admin_pdf_requires_login_and_cors_does_not_allow_other_origins(): void
    {
        $q = $this->pending();
        $this->get('/admin/quotes/'.$q->id.'/pdf')->assertRedirect('/admin/login');
        $this->options('/api/quotes', [], ['Origin' => 'https://example.invalid', 'Access-Control-Request-Method' => 'POST'])->assertHeaderMissing('Access-Control-Allow-Origin');
        $this->options('/api/quotes', [], ['Origin' => 'http://localhost:3100', 'Access-Control-Request-Method' => 'POST'])->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3100');
    }

    public function test_existing_storefront_background_endpoints_keep_working_without_sending_messages(): void
    {
        $headers = ['Origin' => 'http://localhost:3100'];
        $this->postJson('/api/cart', ['id' => 'abcdefghijklmnop1234', 'items' => [['id' => 'CF-EI60-90', 'qty' => 1]]], $headers)->assertNoContent();
        $this->assertDatabaseHas('Cart', ['id' => 'abcdefghijklmnop1234', 'subtotal' => 2200]);
        $this->postJson('/api/t', ['type' => 'product_view', 'productId' => 'CF-EI60-90'], $headers)->assertNoContent();
        $this->assertDatabaseHas('Event', ['type' => 'product_view']);
        $this->postJson('/api/newsletter', ['email' => 'synthetic@example.test', 'consent' => true], $headers)->assertOk();
        $this->postJson('/api/newsletter', ['email' => 'synthetic@example.test', 'consent' => false], $headers)->assertUnprocessable();
        $this->postJson('/api/t', ['type' => 'view'], ['Origin' => 'https://example.invalid'])->assertForbidden();

    }

    public function test_active_promotions_feed_catalog_and_validated_quote_with_no_extra_discount_line(): void
    {
        Promotion::create(['name' => 'Campagne test', 'kind' => 'percent', 'value' => 10, 'scope' => 'product', 'targets' => 'CF-EI60-90', 'active' => true, 'startsAt' => now()->subDay(), 'endsAt' => now()->addDay()]);
        $this->showPublicPrices();
        $this->getJson('/api/catalog')->assertJsonPath('0.price', 1980)->assertJsonPath('0.basePrice', 2200)->assertJsonPath('0.compareAt', 2200);
        $q = $this->pending();
        $this->assertEquals(1980, $q->totalTtc);
        $this->assertEquals(1980, json_decode($q->genInput, true)['lignes'][0]['prix_ttc_walfar']);
        app(QuoteService::class)->validate($q);
        $this->assertEquals('9001', $q->fresh()->number);
    }

    public function test_pack_price_is_exact_even_when_allocation_is_not_divisible_and_quote_is_validatable(): void
    {
        Bundle::create(['slug' => 'test-pack', 'title' => 'Pack test', 'items' => json_encode([['id' => 'CF-EI60-90', 'qty' => 2]]), 'price' => 3999, 'active' => true]);
        $this->postJson('/api/quotes', [...$this->payload(), 'items' => [['id' => 'pack:test-pack', 'qty' => 1]]])->assertCreated();
        $q = Quote::firstOrFail();
        $this->assertEquals(3999, $q->totalTtc);
        $this->assertEquals(2, array_sum(array_column(json_decode($q->lines, true), 'qty')));
        $this->assertEquals('pack:test-pack', json_decode($q->sourceItems, true)[0]['id']);
        app(QuoteService::class)->validate($q);
        $this->assertEquals('validé', $q->fresh()->status);
    }

    public function test_coupon_is_checked_without_consumption_and_consumed_atomically_by_checkout(): void
    {
        Coupon::create(['code' => 'TEST10', 'kind' => 'percent', 'value' => 10, 'minOrder' => 1000, 'usageLimit' => 1, 'active' => true]);
        $this->postJson('/api/coupons/check', ['code' => 'TEST10', 'items' => $this->payload()['items']])->assertOk()->assertJsonPath('discount', null);
        $this->showPublicPrices();
        $this->postJson('/api/coupons/check', ['code' => 'TEST10', 'items' => $this->payload()['items']])->assertOk()->assertJsonPath('discount', 220);
        $this->assertDatabaseHas('Coupon', ['usedCount' => 0]);
        $this->postJson('/api/orders', [...$this->payload(), 'paymentMethod' => 'virement', 'coupon' => 'TEST10'])->assertCreated();
        $this->assertDatabaseHas('Order', ['total' => 1980, 'couponDiscount' => 220]);
        $this->postJson('/api/orders', [...$this->payload(), 'paymentMethod' => 'virement', 'coupon' => 'TEST10'])->assertUnprocessable();
        $this->assertDatabaseCount('Order', 1);
    }

    public function test_shipping_fee_exceptions_are_used_for_orders_and_quote_options(): void
    {
        FeeRule::create(['scope' => 'product', 'target' => 'CF-EI60-90', 'citySlug' => 'casablanca', 'mode' => 'fixed', 'fee' => 120, 'active' => true]);
        $this->postJson('/api/orders', [...$this->payload(), 'pickup' => false, 'deliveryMode' => 'casablanca', 'address' => 'Adresse de test locale', 'paymentMethod' => 'virement'])->assertCreated();
        $this->assertDatabaseHas('Order', ['deliveryFee' => 120, 'total' => 2320]);
        $this->postJson('/api/quotes', [...$this->payload(), 'pickup' => false])->assertCreated();
        $q = Quote::first();
        $this->assertStringContainsString('120 DH TTC en option, hors total', $q->transport);
        $this->assertEquals(2200, $q->totalTtc);
    }

    public function test_new_catalogue_assignments_save_through_filament(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $badge = Badge::create(['label' => 'Nouveau', 'tone' => 'neutral', 'active' => true]);
        $warranty = Warranty::create(['name' => 'Conditions à compléter', 'text' => '', 'active' => true]);
        Attribute::create(['key' => 'largeur', 'label' => 'Largeur', 'unit' => 'cm', 'kind' => 'number', 'active' => true]);
        Livewire::test(EditProduct::class, ['record' => Product::first()->getKey()])->fillForm(['badges' => [(string) $badge->id], 'attributes' => ['largeur' => '90'], 'warrantyId' => $warranty->id])->call('save')->assertHasNoFormErrors();
        $p = Product::first();
        $this->assertEquals('90', json_decode($p->attributes, true)['largeur']);
        $this->assertEquals((string) $badge->id, $p->badges);
        $this->assertEquals($warranty->id, $p->warrantyId);
    }

    public function test_analytics_queries_render_real_demand_data_without_counting_pending_as_sales(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->postJson('/api/orders', $this->payload())->assertCreated();
        $this->get('/admin/analytics')->assertOk()->assertSee('preuve d');
        $this->assertEquals(0, AnalyticsQueries::daily()->first()->sales);
        foreach ([DailySales::class, CitySales::class, ProductSales::class, Funnel::class, TrafficSources::class] as $widget) {
            Livewire::test($widget)->assertStatus(200);
        }
    }

    public function test_new_resources_are_real_authenticated_filament_pages_and_viewers_cannot_create(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        Livewire::test(CreateBundle::class)->fillForm(['slug' => 'pack-filament', 'title' => 'Pack test', 'items' => [['id' => 'CF-EI60-90', 'qty' => 2]], 'price' => 4000, 'active' => true])->call('create')->assertHasNoFormErrors();
        $this->assertDatabaseHas('Bundle', ['slug' => 'pack-filament']);
        foreach (['shippingcitys', 'feerules', 'warrantys', 'attributes', 'badges', 'bundles', 'promotions', 'coupons', 'popups', 'landingpages', 'redirects', 'carts', 'catalogue'] as $slug) {
            $this->get('/admin/'.$slug)->assertOk();
        }
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        $this->assertFalse(PromotionResource::canCreate());
        $this->assertFalse(BundleResource::canEdit(Bundle::first()));
    }

    public function test_redirects_take_effect_and_count_hits_without_allowing_loops_or_admin_overrides(): void
    {
        $redirect = Redirect::create(['from' => '/ancienne-page', 'to' => '/produits', 'code' => 301, 'active' => true]);
        $this->getJson('/api/redirects/resolve?path=/ancienne-page')->assertOk()->assertJsonPath('to', '/produits');
        $this->assertEquals(1, $redirect->fresh()->hits);
        $this->getJson('/api/redirects/resolve?path=/admin')->assertNoContent();
        $this->expectException(ValidationException::class);
        Redirect::create(['from' => '/produits', 'to' => '/ancienne-page', 'code' => 301, 'active' => true]);
    }

    public function test_catalogue_pdf_is_downloadable_without_internal_data_or_counter_access(): void
    {
        $response = $this->get('/api/catalogue.pdf')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF', $response->getContent());
        $this->assertEquals('9000', file_get_contents($this->dir.'/devis/compteur-devis.txt'));
        $pdf = $this->dir.'/out/catalogue-test.pdf';
        file_put_contents($pdf, $response->getContent());
        $txt = (string) shell_exec('pdftotext -layout '.escapeshellarg($pdf).' -');
        $this->assertStringNotContainsString('2 200', $txt);
        $this->assertStringNotContainsString('2200', $txt);
        $this->assertStringContainsString('Prix sur devis', $txt);
    }

    public function test_abandoned_cart_filter_uses_customer_activity_and_never_sends_a_message(): void
    {
        $old = now()->subHour()->getTimestampMs();
        Cart::create(['id' => 'cart-old', 'items' => '[]', 'itemCount' => 1, 'subtotal' => 2200, 'phone' => '0612345678', 'updatedAt' => $old]);
        Cart::create(['id' => 'cart-fresh', 'items' => '[]', 'itemCount' => 1, 'subtotal' => 2200, 'updatedAt' => now()]);
        Cart::create(['id' => 'cart-converted', 'items' => '[]', 'itemCount' => 1, 'subtotal' => 2200, 'status' => 'récupéré', 'updatedAt' => $old]);
        $this->actingAs(User::factory()->create(['role' => 'admin']));
        $this->assertEquals(['cart-old'], CartResource::getEloquentQuery()->pluck('id')->all());
        $cart = Cart::find('cart-old');
        $cart->update(['status' => 'relancé']);
        $this->assertEquals($old, $cart->fresh()->updatedAt->getTimestampMs());
    }
}
