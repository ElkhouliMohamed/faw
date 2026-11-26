<?php

namespace Tests\Feature;

use App\Models\QuoteDecision;
use App\Models\QuoteOtp;
use App\Services\QuoteService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Tests\Concerns\QuoteSandbox;
use Tests\TestCase;

class QuotePortalTest extends TestCase
{
    use QuoteSandbox, RefreshDatabase;

    // setUpQuoteSandbox / tearDownQuoteSandbox run automatically (Laravel trait hooks).

    private function url(string $path = ''): string
    {
        return '/api/portal/'.$this->rawToken.$path;
    }

    private function fakeMail(): void
    {
        $this->enableMail();
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'msg-test'], 200)]);
    }

    private function otpFor(int $versionId): string
    {
        $this->postJson($this->url('/otp'), ['versionId' => $versionId])->assertOk()->assertJsonPath('code', 'otp_sent');

        return $this->lastOtp();
    }

    public function test_portal_shows_the_current_version_without_side_effects(): void
    {
        $this->submitQuote();
        $this->getJson($this->url())->assertOk()->assertJsonPath('quote.ready', false)->assertJsonPath('version', null)->assertJsonPath('actions.canAccept', false);

        $q = $this->validatedQuote(2, false);
        $v = $q->currentVersion();
        $r = $this->getJson($this->url())->assertOk()
            ->assertJsonPath('version.id', $v->id)->assertJsonPath('version.number', '9001')
            ->assertJsonPath('version.lines.0.qty', 2)->assertJsonPath('version.lines.0.unitTtc', 2200)
            ->assertJsonPath('version.totals.total_ttc', 4400)->assertJsonPath('version.delivery.in_total', false)
            ->assertJsonPath('version.expired', false)->assertJsonPath('actions.acceptBlock', 'mail_unavailable')
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->assertContains('Règlement par virement ou chèque encaissé avant retrait de la marchandise.', $r->json('version.conditions'));
        $this->assertSame(now('Africa/Casablanca')->addDays(14)->format('Y-m-d'), $r->json('version.validUntil'));

        $this->fakeMail();
        $this->getJson($this->url())->assertJsonPath('actions.canAccept', true)->assertJsonPath('actions.emailMasked', 'd••••••@resend.dev');
        // No GET side effects: actions only exist as POST, reads write nothing.
        $this->get($this->url('/accept'))->assertStatus(405);
        $this->get($this->url('/otp'))->assertStatus(405);
        $this->assertSame(0, QuoteOtp::count() + QuoteDecision::count());
        $this->getJson('/api/portal/'.str_repeat('A', 32))->assertNotFound();
    }

    public function test_acceptance_needs_confirmation_and_a_valid_email_code_then_records_the_audit_trail(): void
    {
        $this->fakeMail();
        $q = $this->validatedQuote();
        $v = $q->currentVersion();
        $code = $this->otpFor($v->id);
        $this->assertMatchesRegularExpression('/^\d{6}$/', $code);
        $otp = QuoteOtp::sole();
        $this->assertNotSame($code, $otp->code_hash);
        $this->assertSame(QuoteOtp::hashCode($q->id, $code), $otp->code_hash);
        Http::assertSent(fn ($r) => str_contains((string) $r['subject'], 'Code de confirmation') && $r['to'] === ['delivered@resend.dev'] && ! preg_match('/https?:\/\//', $r['text']));

        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $code, 'confirm' => false])->assertStatus(422)->assertJsonPath('code', 'confirm_required');
        $wrong = $code === '000000' ? '111111' : '000000';
        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $wrong, 'confirm' => true])->assertStatus(422)->assertJsonPath('code', 'otp_invalid')->assertJsonPath('remaining', 4);

        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $code, 'confirm' => true], ['X-Faw-Client-Ip' => '41.250.10.20', 'X-Faw-Client-Ua' => 'Mozilla/5.0 (iPhone) test'])
            ->assertOk()->assertJsonPath('code', 'accepted');
        $d = QuoteDecision::where('decision', 'accepted')->sole();
        $this->assertSame($v->id, (int) $d->quote_version_id);
        $this->assertSame('9001', $d->version_number);
        $this->assertSame('41.250.10.20', $d->ip);
        $this->assertSame('Mozilla/5.0 (iPhone) test', $d->user_agent);
        $this->assertNotNull($d->created_at);
        $this->assertSame('accepté', $q->fresh()->customerDecision);
        Http::assertSent(fn ($r) => str_contains((string) $r['subject'], 'accepté par le client') && $r['to'] === ['delivered@resend.dev']);

        // Idempotent: same code again, or a second acceptance, changes nothing.
        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $code, 'confirm' => true])->assertStatus(422)->assertJsonPath('code', 'already_accepted');
        $this->assertSame(1, QuoteDecision::where('decision', 'accepted')->count());
        $this->getJson($this->url())->assertJsonPath('accepted.versionNumber', '9001')->assertJsonPath('actions.canAccept', false)->assertJsonPath('actions.canRequestChange', false);
        $this->postJson($this->url('/modification'), ['message' => 'Changer la quantité svp'])->assertStatus(422)->assertJsonPath('code', 'already_accepted');
        try {
            app(QuoteService::class)->createVersion($q->fresh(), [['position' => 1, 'qty' => 3, 'unit_ttc' => 2200]], ['mode' => 'retrait'], 'après acceptation', false);
            $this->fail('version created after acceptance');
        } catch (ValidationException) {
        }
        $this->assertSame('9001', $this->counterValue());
    }

    public function test_codes_expire_lock_after_five_attempts_and_are_rate_limited(): void
    {
        $this->fakeMail();
        $q = $this->validatedQuote();
        $v = $q->currentVersion();
        $code = $this->otpFor($v->id);
        $wrong = $code === '000000' ? '111111' : '000000';
        for ($i = 1; $i <= 4; $i++) {
            $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $wrong, 'confirm' => true])->assertJsonPath('code', 'otp_invalid');
        }
        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $wrong, 'confirm' => true])->assertJsonPath('code', 'otp_locked');
        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $code, 'confirm' => true])->assertJsonPath('code', 'otp_missing');

        $code = $this->otpFor($v->id);
        $this->travel(11)->minutes();
        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $code, 'confirm' => true])->assertJsonPath('code', 'otp_expired');

        // 3 codes per 15 minutes: the 2nd and 3rd pass, the 4th is refused.
        $this->travel(16)->minutes();
        $this->otpFor($v->id);
        $this->otpFor($v->id);
        $this->otpFor($v->id);
        $this->postJson($this->url('/otp'), ['versionId' => $v->id])->assertStatus(429)->assertJsonPath('code', 'rate_limited');
        // A new code invalidates the previous ones.
        $this->assertSame(1, QuoteOtp::whereNull('locked_at')->whereNull('consumed_at')->count());

        // 10 verification attempts per 15 minutes per quote, across codes.
        $this->travel(16)->minutes();
        for ($i = 0; $i < 2; $i++) {
            $c = $this->otpFor($v->id);
            $w = $c === '000000' ? '111111' : '000000';
            for ($j = 0; $j < 5; $j++) {
                $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $w, 'confirm' => true]);
            }
        }
        $c = $this->otpFor($v->id);
        $this->postJson($this->url('/accept'), ['versionId' => $v->id, 'code' => $c, 'confirm' => true])->assertStatus(429);
        $this->assertSame(0, QuoteDecision::count());
    }

    public function test_acceptance_is_blocked_when_expired_revoked_refused_or_not_current(): void
    {
        $this->fakeMail();
        $q = $this->validatedQuote();
        $v1 = $q->currentVersion();
        $code = $this->otpFor($v1->id);
        app(QuoteService::class)->createVersion($q, [['position' => 1, 'qty' => 2, 'unit_ttc' => 2200]], ['mode' => 'retrait'], 'Quantité 2', false);
        $v2 = $q->fresh()->currentVersion();
        $this->postJson($this->url('/accept'), ['versionId' => $v1->id, 'code' => $code, 'confirm' => true])->assertJsonPath('code', 'not_current');
        $this->postJson($this->url('/otp'), ['versionId' => $v1->id])->assertJsonPath('code', 'not_current');

        $this->postJson($this->url('/refuse'), ['versionId' => $v2->id, 'reason' => 'Trop cher'])->assertOk()->assertJsonPath('code', 'refused_saved');
        $this->assertSame('refusé', $q->fresh()->customerDecision);
        $this->postJson($this->url('/otp'), ['versionId' => $v2->id])->assertJsonPath('code', 'refused');
        Http::assertSent(fn ($r) => str_contains((string) $r['subject'], 'refusé par le client') && str_contains($r['text'], 'Trop cher'));

        $this->postJson($this->url('/modification'), ['message' => 'Pouvez-vous proposer 3 portes ?'])->assertOk();
        $this->assertDatabaseHas('InboxMessage', ['quoteId' => $q->id, 'subject' => 'Modification demandée : devis 9001-2']);
        $this->assertSame('modification demandée', $q->fresh()->customerDecision);
        Http::assertSent(fn ($r) => str_contains((string) $r['subject'], 'modification demandée') && $r['to'] === ['delivered@resend.dev']);

        // The team answers with version 3: acceptable again, until it expires.
        app(QuoteService::class)->createVersion($q->fresh(), [['position' => 1, 'qty' => 3, 'unit_ttc' => 2200]], ['mode' => 'retrait'], '3 portes', false);
        $v3 = $q->fresh()->currentVersion();
        $this->assertNull($q->fresh()->customerDecision);
        $this->getJson($this->url())->assertJsonPath('actions.canAccept', true)->assertJsonPath('version.number', '9001-3');
        $code = $this->otpFor($v3->id);
        $this->travel(15)->days();
        $this->postJson($this->url('/accept'), ['versionId' => $v3->id, 'code' => $code, 'confirm' => true])->assertJsonPath('code', 'expired');
        $this->getJson($this->url())->assertJsonPath('version.expired', true)->assertJsonPath('actions.acceptBlock', 'expired');

        $this->travelBack();
        $q->fresh()->revokeLink();
        $this->getJson($this->url())->assertNotFound();
        $this->postJson($this->url('/accept'), ['versionId' => $v3->id, 'code' => $code, 'confirm' => true])->assertNotFound();
        $this->assertSame(0, QuoteDecision::where('decision', 'accepted')->count());
    }

    public function test_decisions_are_append_only_and_modification_messages_are_validated(): void
    {
        $this->fakeMail();
        $this->validatedQuote();
        $this->postJson($this->url('/modification'), ['message' => 'ok'])->assertStatus(422)->assertJsonPath('code', 'message_invalid');
        $this->postJson($this->url('/modification'), ['message' => 'Livraison à Rabat possible ?'])->assertOk();
        $d = QuoteDecision::sole();
        $this->expectException(\LogicException::class);
        $d->update(['message' => 'changé']);
    }
}
