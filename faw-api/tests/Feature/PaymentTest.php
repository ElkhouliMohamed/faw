<?php

namespace Tests\Feature;

use App\Filament\Resources\CustomerOrders\Pages\ManageCustomerOrders;
use App\Models\CustomerOrder;
use App\Models\Payment;
use App\Models\PaymentTransaction;
use App\Models\User;
use App\Payments\CardProvider;
use App\Payments\PaymentProviders;
use App\Services\PaymentService;
use App\Support\OrderStatus;
use App\Support\PaymentStatus;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\Concerns\AcceptsQuotes;
use Tests\Concerns\QuoteSandbox;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use AcceptsQuotes, QuoteSandbox, RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    private function order(): CustomerOrder
    {
        Storage::fake('local');
        $this->fakeResend();
        $q = $this->validatedQuote(2, false); // 4400 DH TTC
        $this->acceptCurrent($q, $this->rawToken)->assertOk();

        return CustomerOrder::where('quote_id', $q->id)->sole();
    }

    private function role(string $r): User
    {
        return User::factory()->create(['role' => $r]);
    }

    private function png(string $name = 'virement.png'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'png');
        file_put_contents($path, base64_decode(self::PNG));

        return new UploadedFile($path, $name, 'image/png', null, true);
    }

    private function upload(Payment $p, UploadedFile $f): TestResponse
    {
        return $this->post('/api/portal/'.$this->rawToken.'/payments/'.$p->id.'/proof', ['proof' => $f], ['Accept' => 'application/json']);
    }

    public function test_default_schedule_is_one_full_bank_transfer_without_invented_bank_details(): void
    {
        $o = $this->order();
        $p = Payment::sole();
        $this->assertSame([4400, 'MAD', 'bank_transfer', $o->reference.'-P1', PaymentStatus::Awaiting], [$p->amount, $p->currency, $p->provider, $p->reference, $p->status]);
        $this->getJson('/api/portal/'.$this->rawToken)->assertOk()
            ->assertJsonPath('order.payment.due', 4400)->assertJsonPath('order.payment.paid', 0)
            ->assertJsonPath('order.payment.bank', ['rib' => null, 'iban' => null, 'holder' => null, 'bankName' => null, 'branch' => null, 'swift' => null])
            ->assertJsonPath('order.payment.cardAvailable', false)
            ->assertJsonPath('order.payment.payments.0.reference', $p->reference)->assertJsonPath('order.payment.payments.0.canUploadProof', true);
        config(['faw.bank.rib' => '000 TEST RIB 000']);
        $this->getJson('/api/portal/'.$this->rawToken)->assertJsonPath('order.payment.bank.rib', '000 TEST RIB 000');
    }

    public function test_schedule_amounts_are_typed_by_faw_and_must_equal_the_total(): void
    {
        $o = $this->order();
        $svc = app(PaymentService::class);
        foreach ([[['amount' => 1000], ['amount' => 3401]], [['amount' => '10%'], ['amount' => 3960]], [['amount' => 0], ['amount' => 4400]], [['amount' => 4400.5]]] as $bad) {
            try {
                $svc->setSchedule($o, $bad, $this->role('sales_manager'));
                $this->fail('accepted '.json_encode($bad));
            } catch (ValidationException) {
            }
        }
        foreach (['viewer', 'stock_manager', 'sales_rep'] as $r) {
            try {
                $svc->setSchedule($o, [['amount' => 4400]], $this->role($r));
                $this->fail($r.' changed the schedule');
            } catch (ValidationException) {
            }
        }
        $svc->setSchedule($o, [['label' => 'Acompte', 'amount' => 1000], ['label' => 'Solde', 'amount' => 3400]], $this->role('finance_manager'), 'Accord client');
        $this->assertSame([PaymentStatus::Cancelled], Payment::where('reference', $o->reference.'-P1')->pluck('status')->all());
        $this->assertSame([[$o->reference.'-P2', 1000], [$o->reference.'-P3', 3400]], collect($svc->schedule($o))->map(fn ($p) => [$p->reference, $p->amount])->all());

        $this->expectException(\LogicException::class);
        Payment::where('reference', $o->reference.'-P2')->first()->update(['amount' => 1]);
    }

    public function test_proof_upload_is_private_type_checked_and_size_limited(): void
    {
        $o = $this->order();
        $p = Payment::sole();
        $fake = tempnam(sys_get_temp_dir(), 'x');
        file_put_contents($fake, "<?php echo 'x';");
        $this->upload($p, new UploadedFile($fake, 'virement.png', 'image/png', null, true))->assertStatus(422)->assertJsonPath('code', 'proof_bad_type');
        $this->upload($p, UploadedFile::fake()->create('gros.pdf', 5 * 1024 + 1, 'application/pdf'))->assertStatus(422)->assertJsonPath('code', 'proof_too_large');
        $this->post('/api/portal/'.$this->rawToken.'/payments/'.$p->id.'/proof', [], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonPath('code', 'proof_missing');
        $this->post('/api/portal/'.$this->rawToken.'/payments/999/proof', ['proof' => $this->png()], ['Accept' => 'application/json'])->assertNotFound();
        $this->assertSame(PaymentStatus::Awaiting, $p->fresh()->status);

        $this->upload($p, $this->png())->assertOk()->assertJsonPath('code', 'proof_saved');
        $p->refresh();
        $this->assertSame([PaymentStatus::PendingVerification, 'image/png'], [$p->status, $p->proof_mime]);
        $this->assertStringStartsWith('payment-proofs/'.$o->id.'/', $p->proof_path);
        Storage::disk('local')->assertExists($p->proof_path);
        $this->assertSame('private', basename(config('filesystems.disks.local.root')));
        $this->assertSame(['created', 'proof_uploaded'], PaymentTransaction::where('payment_id', $p->id)->orderBy('id')->pluck('type')->all());
        $this->upload($p, $this->png())->assertStatus(422)->assertJsonPath('code', 'proof_not_allowed');
        $team = collect(Http::recorded())->map(fn ($r) => $r[0]->data())->filter(fn ($d) => str_contains($d['subject'] ?? '', 'paiement'))->values();
        $this->assertCount(1, $team);
        $this->assertSame(['delivered@resend.dev'], (array) $team[0]['to']);

        $pdf = tempnam(sys_get_temp_dir(), 'pdf');
        file_put_contents($pdf, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
        app(PaymentService::class)->reject($p, $this->role('finance_manager'), 'Montant illisible');
        $this->upload($p->fresh(), new UploadedFile($pdf, 'virement.pdf', 'application/pdf', null, true))->assertOk();
        $this->assertSame('application/pdf', $p->fresh()->proof_mime);
    }

    public function test_finance_validates_payments_and_the_order_follows(): void
    {
        $o = $this->order();
        $svc = app(PaymentService::class);
        $svc->setSchedule($o, [['label' => 'Acompte', 'amount' => 1000], ['label' => 'Solde', 'amount' => 3400]], $this->role('sales_manager'));
        [$deposit, $balance] = $svc->schedule($o);
        foreach (['sales_manager', 'stock_manager', 'viewer'] as $r) {
            try {
                $svc->confirm($deposit, $this->role($r));
                $this->fail($r.' confirmed a payment');
            } catch (ValidationException) {
            }
        }
        $finance = $this->role('finance_manager');
        $svc->confirm($deposit, $finance, 'Virement reçu');
        $this->assertSame(OrderStatus::PartiallyPaid, $o->fresh()->status);
        try {
            $svc->setSchedule($o, [['amount' => 4400]], $finance);
            $this->fail('schedule changed after a confirmed payment');
        } catch (ValidationException) {
        }
        $svc->confirm($balance, $this->role('super_admin'));
        $this->assertSame(OrderStatus::PaymentConfirmed, $o->fresh()->status);
        $this->assertSame(['en_attente_paiement', 'partiellement_paye', 'paiement_confirme'], $o->history()->pluck('to_status')->all());
        $this->assertSame('payment', $o->history()->get()->last()->source);
        $this->getJson('/api/portal/'.$this->rawToken)->assertJsonPath('order.payment.paid', 4400)->assertJsonPath('order.payment.due', 0)->assertJsonPath('order.status', 'paiement_confirme');
        $this->expectException(\LogicException::class);
        PaymentTransaction::first()->delete();
    }

    public function test_admin_proof_download_and_filament_payment_actions_follow_roles(): void
    {
        $o = $this->order();
        $p = Payment::sole();
        $this->upload($p, $this->png())->assertOk();
        foreach (['finance_manager' => 200, 'sales_manager' => 200, 'super_admin' => 200, 'viewer' => 403, 'stock_manager' => 403, 'sales_rep' => 403] as $r => $code) {
            $this->actingAs($this->role($r))->get('/admin/payments/'.$p->id.'/proof')->assertStatus($code);
        }
        $this->actingAs($this->role('finance_manager'))->get('/admin/payments/'.$p->id.'/proof')->assertHeader('Content-Type', 'image/png')->assertHeader('Cache-Control', 'no-store, private');

        foreach (['finance_manager' => [true, true], 'super_admin' => [true, true], 'sales_manager' => [true, false], 'stock_manager' => [false, false], 'viewer' => [false, false]] as $r => [$schedule, $validate]) {
            $this->actingAs($this->role($r));
            $lw = Livewire::test(ManageCustomerOrders::class);
            $schedule ? $lw->assertActionVisible(TestAction::make('echeancier')->table($o)) : $lw->assertActionHidden(TestAction::make('echeancier')->table($o));
            $validate ? $lw->assertActionVisible(TestAction::make('validerPaiement')->table($o)) : $lw->assertActionHidden(TestAction::make('validerPaiement')->table($o));
            $validate ? $lw->assertActionVisible(TestAction::make('rejeterJustificatif')->table($o)) : $lw->assertActionHidden(TestAction::make('rejeterJustificatif')->table($o));
        }
        $this->actingAs($this->role('finance_manager'));
        Livewire::test(ManageCustomerOrders::class)->callAction(TestAction::make('validerPaiement')->table($o), data: ['payment' => $p->id, 'note' => 'Reçu le 11/11'])->assertHasNoActionErrors();
        $this->assertSame(PaymentStatus::Confirmed, $p->fresh()->status);
        $this->assertSame(OrderStatus::PaymentConfirmed, $o->fresh()->status);
        Livewire::test(ManageCustomerOrders::class)->mountAction(TestAction::make('view')->table($o))->assertMountedActionModalSee(['Paiements', $p->reference, 'Paiement par carte : désactivé']);

        // Deposit schedule from the form on a fresh order.
        $q2 = $this->validatedQuote(1, true); // 2200
        $this->acceptCurrent($q2, $this->rawToken)->assertOk();
        $o2 = CustomerOrder::where('quote_id', $q2->id)->sole();
        $this->actingAs($this->role('sales_manager'));
        Livewire::test(ManageCustomerOrders::class)->callAction(TestAction::make('echeancier')->table($o2), data: ['mode' => 'acompte', 'deposit' => 700])->assertHasNoActionErrors();
        $this->assertSame([700, 1500], collect(app(PaymentService::class)->schedule($o2))->pluck('amount')->all());
    }

    public function test_card_webhook_is_disabled_and_the_skeleton_checks_everything(): void
    {
        $o = $this->order();
        foreach (['card', 'bank_transfer', 'naps', 'cmi'] as $prov) {
            $this->postJson('/api/payments/webhook/'.$prov, ['event_id' => 'e1'])->assertStatus(503);
        }
        $this->assertFalse(app(CardProvider::class)->enabled());
        $this->assertSame(PaymentStatus::Awaiting, Payment::sole()->status);

        // Test-only adapter: same verification contract, enabled, with a test secret.
        app(PaymentProviders::class)->register(new class extends CardProvider
        {
            public function key(): string
            {
                return 'card_test';
            }

            public function enabled(): bool
            {
                return true;
            }

            protected function secret(): string
            {
                return 'test-secret';
            }
        });
        $pay = Payment::create(['customer_order_id' => $o->id, 'position' => 9, 'label' => 'Test carte', 'amount' => 4400, 'currency' => 'MAD', 'provider' => 'card_test', 'reference' => 'TEST-CARD-1', 'status' => PaymentStatus::Awaiting]);
        $send = function (array $body, ?string $sig = null) {
            $raw = json_encode($body);

            return $this->call('POST', '/api/payments/webhook/card_test', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_X_FAW_SIGNATURE' => $sig ?? hash_hmac('sha256', $raw, 'test-secret')], $raw);
        };
        $ok = ['event_id' => 'evt-1', 'reference' => 'TEST-CARD-1', 'amount' => 4400, 'currency' => 'MAD', 'status' => 'paid', 'transaction_id' => 'tx-1'];
        $send($ok, 'bad')->assertStatus(401);
        $send(['currency' => 'EUR'] + $ok)->assertStatus(422)->assertJsonPath('error', 'bad_currency');
        $send(['amount' => 4399] + $ok)->assertStatus(422)->assertJsonPath('error', 'amount_mismatch');
        $send(['reference' => 'FAW-CMD-0000-0000-P1'] + $ok)->assertStatus(404);
        $send(['reference' => Payment::where('provider', 'bank_transfer')->value('reference')] + $ok)->assertStatus(404); // other provider's payment
        $this->assertSame(PaymentStatus::Awaiting, $pay->fresh()->status);
        $send($ok)->assertOk()->assertJsonMissingPath('duplicate');
        $send($ok)->assertOk()->assertJsonPath('duplicate', true);
        $this->assertSame([PaymentStatus::Confirmed, 'tx-1'], [$pay->fresh()->status, $pay->fresh()->provider_transaction_id]);
        $this->assertSame(1, PaymentTransaction::where('payment_id', $pay->id)->where('type', 'confirmed')->count());
        $this->assertDatabaseCount('payment_webhook_events', 1);
    }
}
