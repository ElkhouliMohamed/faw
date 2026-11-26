<?php

namespace Tests\Feature;

use App\Logging\RedactSensitiveData;
use App\Models\Product;
use App\Models\Quote;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/** Customer quote links: hashed at rest, expiring, revocable, rate limited, never logged in clear. */
class QuoteTokenTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
    }

    private function quote(array $extra = []): array
    {
        $raw = Quote::newRawToken();
        $q = Quote::create(['clientName' => 'Client synthétique', 'city' => 'Casablanca', 'totalHt' => 1000, 'totalTtc' => 1200, 'transport' => 'Retrait', 'lines' => '[]', 'email' => 'delivered@resend.dev', 'token' => $raw, ...$extra]);

        return [$q->fresh(), $raw];
    }

    public function test_token_is_stored_only_as_sha256_with_an_expiry(): void
    {
        [$q, $raw] = $this->quote();
        $row = DB::table('Quote')->where('id', $q->id)->first();
        $this->assertSame(hash('sha256', $raw), $row->tokenHash);
        $this->assertSame($row->tokenHash, $row->token, 'legacy column keeps only the hash');
        $this->assertStringNotContainsString($raw, json_encode($row));
        $this->assertTrue($q->tokenExpiresAt->isFuture());
        $this->assertEqualsWithDelta(now()->addDays(90)->getTimestamp(), $q->tokenExpiresAt->getTimestamp(), 5);
        $this->assertArrayNotHasKey('tokenHash', $q->toArray());
    }

    public function test_api_submission_returns_a_working_raw_link_once(): void
    {
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'updatedAt' => now()]);
        $raw = $this->postJson('/api/quotes', ['name' => 'Client synthétique', 'phone' => '0600000001', 'email' => 'delivered@resend.dev', 'city' => 'Casablanca', 'pickup' => true, 'items' => [['id' => 'CF-EI60-90', 'qty' => 1]]])->assertCreated()->json('token');
        $this->assertMatchesRegularExpression(Quote::TOKEN_PATTERN, $raw);
        $this->getJson('/api/quotes/'.$raw)->assertOk()->assertJsonPath('status', 'à valider')->assertHeader('Cache-Control', 'no-store, private');
        $this->assertDatabaseMissing('Quote', ['token' => $raw]);
    }

    public function test_valid_link_works(): void
    {
        [, $raw] = $this->quote();
        $this->getJson('/api/quotes/'.$raw)->assertOk()->assertJsonPath('status', 'à valider');
    }

    public function test_expired_link_is_refused(): void
    {
        [$q, $raw] = $this->quote();
        $q->forceFill(['tokenExpiresAt' => now()->subMinute()])->save();
        $this->getJson('/api/quotes/'.$raw)->assertNotFound();
        $this->get('/api/quotes/'.$raw.'/pdf')->assertNotFound();
        $this->assertSame('expiré', $q->fresh()->linkState());
    }

    public function test_revoked_link_is_refused_and_regeneration_issues_a_new_one(): void
    {
        [$q, $raw] = $this->quote();
        $q->revokeLink();
        $this->getJson('/api/quotes/'.$raw)->assertNotFound();
        $this->assertSame('révoqué', $q->fresh()->linkState());
        $new = $q->fresh()->regenerateLink();
        $this->assertNotSame($raw, $new);
        $this->getJson('/api/quotes/'.$raw)->assertNotFound();
        $this->getJson('/api/quotes/'.$new)->assertOk();
    }

    public function test_wrong_malformed_or_hash_tokens_are_refused_identically(): void
    {
        [$q] = $this->quote();
        foreach ([Quote::newRawToken(), 'short', str_repeat('a', 33), $q->tokenHash, DB::table('Quote')->value('token')] as $bad) {
            $this->getJson('/api/quotes/'.$bad)->assertNotFound();
        }
    }

    public function test_private_link_endpoint_is_rate_limited(): void
    {
        [, $raw] = $this->quote();
        for ($i = 0; $i < 30; $i++) {
            $this->assertNotSame(429, $this->getJson('/api/quotes/'.$raw)->status());
        }
        $this->getJson('/api/quotes/'.$raw)->assertStatus(429);
        $this->getJson('/api/quotes/'.Quote::newRawToken())->assertStatus(429);
    }

    public function test_raw_tokens_and_personal_data_are_redacted_from_logs(): void
    {
        $file = storage_path('logs/redaction-test-'.bin2hex(random_bytes(4)).'.log');
        config(['logging.channels.redaction' => ['driver' => 'single', 'path' => $file, 'tap' => [RedactSensitiveData::class]]]);
        $raw = Quote::newRawToken();
        Log::channel('redaction')->error("GET /api/quotes/$raw/pdf from delivered@resend.dev +212612345678 key re_abcdefghijklmnop", ['token' => $raw, 'url' => "https://x/devis/suivi/$raw"]);
        $out = file_get_contents($file);
        @unlink($file);
        $this->assertStringNotContainsString($raw, $out);
        $this->assertStringNotContainsString('delivered@resend.dev', $out);
        $this->assertStringNotContainsString('612345678', $out);
        $this->assertStringNotContainsString('re_abcdefghijklmnop', $out);
        $this->assertStringContainsString('[jeton]', $out);
    }

    public function test_data_migrations_keep_already_sent_links_working(): void
    {
        $raw = Quote::newRawToken();
        $id = DB::table('Quote')->insertGetId(['clientName' => 'Ancien devis', 'city' => 'Rabat', 'totalHt' => 1, 'totalTtc' => 1, 'transport' => '-', 'lines' => '[]', 'token' => $raw, 'status' => 'envoyé']);
        $this->assertNull(DB::table('Quote')->where('id', $id)->value('tokenHash'));

        (require database_path('migrations/2026_11_11_160000_add_quote_token_security.php'))->up();
        $row = DB::table('Quote')->where('id', $id)->first();
        $this->assertSame(hash('sha256', $raw), $row->tokenHash);
        $this->assertSame($raw, $row->token, 'step 1 is additive: plaintext untouched');
        $this->assertGreaterThan(now()->getTimestampMs(), (int) $row->tokenExpiresAt);
        $this->getJson('/api/quotes/'.$raw)->assertOk();

        (require database_path('migrations/2026_11_11_160100_scrub_plaintext_quote_tokens.php'))->up();
        $row = DB::table('Quote')->where('id', $id)->first();
        $this->assertSame($row->tokenHash, $row->token);
        $this->assertDatabaseMissing('Quote', ['token' => $raw]);
        $this->getJson('/api/quotes/'.$raw)->assertOk();
    }
}
