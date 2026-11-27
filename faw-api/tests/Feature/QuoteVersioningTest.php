<?php

namespace Tests\Feature;

use App\Filament\Resources\Quotes\Pages\ListQuotes;
use App\Filament\Resources\Quotes\Pages\ViewQuote;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\Quote;
use App\Models\QuoteVersion;
use App\Models\QuoteVersionEmail;
use App\Models\ShippingCity;
use App\Models\User;
use App\Services\QuoteService;
use Filament\Actions\Testing\TestAction;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\TestCase;

class QuoteVersioningTest extends TestCase
{
    use RefreshDatabase;

    protected string $dir;

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
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'updatedAt' => now()]);
        Category::create(['slug' => 'portes-coupe-feu', 'label' => 'Portes coupe-feu', 'family' => 'portes-coupe-feu', 'updatedAt' => now()]);
    }

    protected function tearDown(): void
    {
        if (isset($this->dir)) {
            File::deleteDirectory($this->dir);
        }
        parent::tearDown();
    }

    private function counter(): string
    {
        return trim(file_get_contents($this->dir.'/devis/compteur-devis.txt'));
    }

    private function validated(int $qty = 1, bool $pickup = true): Quote
    {
        $this->postJson('/api/quotes', ['name' => 'Client test local', 'phone' => '0612345678', 'email' => 'delivered@resend.dev', 'city' => 'Casablanca', 'pickup' => $pickup, 'items' => [['id' => 'CF-EI60-90', 'qty' => $qty]]])->assertCreated();
        $q = Quote::firstOrFail();
        app(QuoteService::class)->validate($q);

        return $q->fresh();
    }

    private function enableResend(): void
    {
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
    }

    private function lines(QuoteVersion $v, ?int $qty = null, ?int $unit = null): array
    {
        return array_map(fn ($l) => ['position' => $l['position'], 'qty' => $qty ?? $l['qty'], 'unit_ttc' => $unit ?? $l['unit_ttc']], $v->lines);
    }

    public function test_validation_freezes_version_one_with_the_reserved_number_and_a_full_snapshot(): void
    {
        $q = $this->validated(2, false);
        $this->assertSame('9001', $this->counter());
        $v = QuoteVersion::where('quote_id', $q->id)->sole();
        $this->assertSame(1, $v->version);
        $this->assertSame('9001', $v->number);
        $this->assertSame('9001', $q->versionNumber);
        $this->assertSame('Devis-9001-FAW.pdf', $v->pdf_file);
        $this->assertSame(hash_file('sha256', $this->dir.'/out/Devis-9001-FAW.pdf'), $v->pdf_sha256);
        $line = $v->lines[0];
        $this->assertSame(['position' => 1, 'reference' => 'CF-EI60-90', 'name' => 'Porte coupe-feu EI60 90 cm', 'qty' => 2], array_intersect_key($line, array_flip(['position', 'reference', 'name', 'qty'])));
        $this->assertSame(2200, $line['unit_ttc']);
        $this->assertSame(0, $line['discount_rate']);
        $this->assertSame(20, $line['tax_rate']);
        $this->assertSame(4400, $line['total_ttc']);
        $this->assertSame('Portes coupe-feu', $line['config']['category']);
        $this->assertSame(4400, $v->total_ttc);
        $this->assertSame(['subtotal_ttc' => 4400, 'discount_ttc' => 0, 'total_ht' => 3666.67, 'tax_rate' => 20, 'tax_amount' => 733.33, 'total_ttc' => 4400], $v->totals);
        $this->assertSame('option', $v->delivery['mode']);
        $this->assertFalse($v->delivery['in_total']);
        $this->assertSame(400, $v->delivery['amount_ttc']);
        $this->assertSame('MAD', $v->currency);
        $this->assertSame(14, $v->validity_days);
        $this->assertSame(now('Africa/Casablanca')->addDays(14)->format('Y-m-d'), substr((string) $v->valid_until, 0, 10));
        $this->assertContains('Fourniture seule, installation non incluse.', $v->conditions);
        $this->assertSame(4400, $q->totalTtc);
    }

    public function test_product_price_changes_never_alter_an_issued_version(): void
    {
        $q = $this->validated();
        $v1 = QuoteVersion::where('quote_id', $q->id)->sole();
        $before = [$v1->lines, $v1->totals, $v1->total_ttc, hash_file('sha256', $this->dir.'/out/'.$v1->pdf_file)];

        Product::first()->update(['price' => 2500]);
        $csv = $this->dir.'/produits/produits-reference.csv';
        file_put_contents($csv, str_replace(',2200,', ',2500,', file_get_contents($csv)));

        $v1 = $v1->fresh();
        $this->assertSame($before, [$v1->lines, $v1->totals, $v1->total_ttc, hash_file('sha256', $this->dir.'/out/'.$v1->pdf_file)]);
        $this->assertSame(2200, $q->fresh()->totalTtc);

        // A later version keeps the frozen unit price unless the team edits it explicitly.
        [$v2] = app(QuoteService::class)->createVersion($q, $this->lines($v1, 3), ['mode' => 'retrait'], 'Quantité 3', false);
        $this->assertSame(2200, $v2->lines[0]['unit_ttc']);
        $this->assertSame(6600, $v2->total_ttc);
        $this->assertSame($before[3], hash_file('sha256', $this->dir.'/out/'.$v1->pdf_file));

        // Content is frozen in the model and in the database.
        try {
            $v1->update(['total_ttc' => 1]);
            $this->fail('model update allowed');
        } catch (\LogicException) {
        }
        try {
            DB::table('quote_versions')->where('id', $v1->id)->update(['lines' => '[]']);
            $this->fail('db update allowed');
        } catch (QueryException $e) {
            $this->assertStringContainsString('immutable', $e->getMessage());
        }
        try {
            DB::table('quote_versions')->where('id', $v1->id)->delete();
            $this->fail('db delete allowed');
        } catch (QueryException) {
        }
        $this->expectException(\LogicException::class);
        $v1->delete();
    }

    public function test_new_versions_get_numbered_labels_new_pdfs_and_never_reserve_a_number(): void
    {
        $q = $this->validated();
        $v1 = QuoteVersion::where('quote_id', $q->id)->sole();
        $sha1 = hash_file('sha256', $this->dir.'/out/Devis-9001-FAW.pdf');

        [$v2] = app(QuoteService::class)->createVersion($q, $this->lines($v1, 2, 2100), ['mode' => 'option', 'ville' => 'Casablanca', 'montant' => 450], 'Remise accordée par Walfar', false);
        $this->assertSame('9001-2', $v2->number);
        $this->assertSame('Devis-9001-FAW-2.pdf', $v2->pdf_file);
        $this->assertFileExists($this->dir.'/out/Devis-9001-FAW-2.pdf');
        $this->assertSame($sha1, hash_file('sha256', $this->dir.'/out/Devis-9001-FAW.pdf'));
        $this->assertSame(4200, $v2->total_ttc);
        $this->assertSame(450, $v2->delivery['amount_ttc']);
        $this->assertFalse($v2->delivery['in_total']);
        $this->assertSame('Remise accordée par Walfar', $v2->reason);
        $this->assertSame('9001', $this->counter());

        $q->refresh();
        $this->assertSame('9001', $q->number);
        $this->assertSame('9001-2', $q->versionNumber);
        $this->assertSame('Devis-9001-FAW-2.pdf', $q->pdfFile);
        $this->assertSame(4200, $q->totalTtc);

        config(['faw.quote_version_format' => '{numero}/V{version}']);
        [$v3] = app(QuoteService::class)->createVersion($q, $this->lines($v2, 1), ['mode' => 'retrait'], 'Retrait finalement', false);
        $this->assertSame('9001/V3', $v3->number);
        $this->assertSame('Devis-9001-FAW-3.pdf', $v3->pdf_file);
        $this->assertSame([1, 2, 3], QuoteVersion::where('quote_id', $q->id)->orderBy('version')->pluck('version')->all());
        foreach (['Devis-9001-FAW.pdf', 'Devis-9001-FAW-2.pdf', 'Devis-9001-FAW-3.pdf'] as $f) {
            $this->assertFileExists($this->dir.'/out/'.$f);
        }
        $this->assertSame('9001', $this->counter());
        $this->assertCount(1, file($this->dir.'/devis/journal-devis.csv'));
    }

    public function test_versioning_refuses_no_change_unvalidated_quotes_and_never_overwrites_a_pdf(): void
    {
        $this->postJson('/api/quotes', ['name' => 'Client test local', 'phone' => '0612345678', 'email' => 'delivered@resend.dev', 'city' => 'Casablanca', 'pickup' => true, 'items' => [['id' => 'CF-EI60-90', 'qty' => 1]]])->assertCreated();
        $pending = Quote::firstOrFail();
        try {
            app(QuoteService::class)->createVersion($pending, [['position' => 1, 'qty' => 2, 'unit_ttc' => 2200]], ['mode' => 'retrait'], 'x', false);
            $this->fail('pending quote versioned');
        } catch (ValidationException) {
        }
        $this->assertSame('9000', $this->counter());

        app(QuoteService::class)->validate($pending);
        $q = $pending->fresh();
        $v1 = $q->currentVersion();
        try {
            app(QuoteService::class)->createVersion($q, $this->lines($v1), ['mode' => 'retrait'], 'Rien', false);
            $this->fail('no-change version created');
        } catch (ValidationException) {
        }
        try {
            app(QuoteService::class)->createVersion($q, $this->lines($v1, 2), ['mode' => 'retrait'], '   ', false);
            $this->fail('version without reason');
        } catch (ValidationException) {
        }

        file_put_contents($this->dir.'/out/Devis-9001-FAW-2.pdf', 'existing');
        try {
            app(QuoteService::class)->createVersion($q, $this->lines($v1, 2), ['mode' => 'retrait'], 'Quantité', false);
            $this->fail('existing PDF overwritten');
        } catch (\RuntimeException) {
        }
        $this->assertSame('existing', file_get_contents($this->dir.'/out/Devis-9001-FAW-2.pdf'));
        $this->assertSame(1, QuoteVersion::where('quote_id', $q->id)->count());
    }

    public function test_each_version_has_its_own_idempotent_email_delivery(): void
    {
        $this->enableResend();
        Http::fake(['api.resend.com/*' => Http::sequence()->push(['id' => 'msg-v1'], 200)->push(['id' => 'msg-v2'], 200)]);
        $q = $this->validated();
        $v1 = $q->currentVersion();
        $this->assertSame('sent', $v1->email_status);
        $this->assertSame('msg-v1', $v1->email_message_id);

        // Repeated sends of an already delivered version: no second PDF, email or journal row.
        app(QuoteService::class)->sendEmail($q->fresh());
        app(QuoteService::class)->sendEmail($q->fresh());
        Http::assertSentCount(1);

        [$v2, $message] = app(QuoteService::class)->createVersion($q, $this->lines($v1, 2), ['mode' => 'retrait'], 'Quantité 2', true);
        $this->assertStringContainsString('Email envoyé', $message);
        $v2->refresh();
        $this->assertSame('sent', $v2->email_status);
        $this->assertSame('msg-v2', $v2->email_message_id);
        Http::assertSentCount(2);
        $keys = [];
        Http::assertSent(function ($r) use (&$keys) {
            $keys[] = $r->header('Idempotency-Key')[0];

            return $r['to'] === ['delivered@resend.dev'];
        });
        $this->assertSame(['faw-devis-'.$q->id.'-v1-1', 'faw-devis-'.$q->id.'-v2-1'], $keys);
        Http::assertSent(fn ($r) => str_contains($r['subject'], '9001-2') && collect($r['attachments'])->contains('filename', 'Devis-9001-FAW-2.pdf'));

        $this->assertSame(['sent'], QuoteVersionEmail::where('quote_version_id', $v2->id)->pluck('status')->all());
        $journal = file($this->dir.'/devis/journal-devis.csv');
        $this->assertCount(3, $journal);
        $this->assertStringStartsWith('9001-2,', $journal[2]);
        $this->assertTrue($v2->journaled);
        $this->assertSame('envoyé', $q->fresh()->status);
        $this->assertSame('9001', $this->counter());

        // The unique key blocks a duplicate attempt row even outside the service.
        $this->expectException(UniqueConstraintViolationException::class);
        QuoteVersionEmail::create(['quote_version_id' => $v2->id, 'attempt' => 1, 'idempotency_key' => 'faw-devis-'.$q->id.'-v2-1', 'kind' => 'auto', 'status' => 'queued']);
    }

    public function test_in_flight_delivery_blocks_a_concurrent_send_and_failures_can_be_resent(): void
    {
        $q = $this->validated();
        $v1 = $q->currentVersion();
        $this->assertNull($v1->email_status); // email transport disabled: nothing sent
        $this->enableResend();

        QuoteVersionEmail::create(['quote_version_id' => $v1->id, 'attempt' => 1, 'idempotency_key' => 'faw-devis-'.$q->id.'-v1-1', 'kind' => 'auto', 'status' => 'queued', 'queued_at' => now()]);
        Http::fake(['api.resend.com/*' => Http::sequence()->push(['message' => 'down'], 500)->push(['id' => 'msg-ok'], 200)]);
        $this->assertStringContainsString('déjà en cours', app(QuoteService::class)->sendEmail($q->fresh()));
        Http::assertNothingSent();

        $this->travel(11)->minutes(); // stale claim: marked failed, a new attempt is allowed
        $this->assertStringContainsString('email non envoyé', app(QuoteService::class)->sendEmail($q->fresh()));
        $this->assertSame('failed', $v1->fresh()->email_status);
        $this->assertSame(['failed', 'failed'], QuoteVersionEmail::where('quote_version_id', $v1->id)->orderBy('attempt')->pluck('status')->all());

        $this->travel(1)->minutes();
        $this->assertStringContainsString('Email envoyé', app(QuoteService::class)->sendEmail($q->fresh(), true));
        $this->assertSame('sent', $v1->fresh()->email_status);
        $this->assertSame([1, 2, 3], QuoteVersionEmail::where('quote_version_id', $v1->id)->orderBy('attempt')->pluck('attempt')->all());
        Http::assertSentCount(2);
    }

    public function test_new_version_action_needs_validate_quotes_and_versions_tab_is_read_only_for_viewers(): void
    {
        $q = $this->validated();
        $expect = ['super_admin' => true, 'sales_manager' => true, 'sales_rep' => false, 'viewer' => false];
        foreach ($expect as $role => $can) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $lw = Livewire::test(ListQuotes::class);
            $can ? $lw->assertActionVisible(TestAction::make('nouvelleVersion')->table($q)) : $lw->assertActionHidden(TestAction::make('nouvelleVersion')->table($q));
            auth()->logout();
        }

        // The viewer can open the quote and read the versions tab, but cannot run the action.
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        Livewire::test(ViewQuote::class, ['record' => $q->getKey()])->assertHasNoErrors()->assertSee(['Versions', 'Devis-9001-FAW.pdf', '9001'])->assertActionHidden('nouvelleVersion');
        $html = (string) QuoteResource::versionsHtml($q);
        $this->assertStringContainsString('Devis-9001-FAW.pdf', $html);
        $this->assertStringContainsString(route('admin.quote.version.pdf', [$q, 1]), $html);
        $this->assertStringContainsString('non envoyé', $html);
        $this->get(route('admin.quote.version.pdf', [$q, 1]))->assertOk();
        try {
            Livewire::test(ListQuotes::class)->callAction(TestAction::make('nouvelleVersion')->table($q), data: ['lines' => [['position' => 1, 'qty' => 5, 'unit_ttc' => 2200]], 'mode' => 'retrait', 'reason' => 'x']);
        } catch (\Throwable) {
        }
        $this->assertSame(1, QuoteVersion::where('quote_id', $q->id)->count());
        auth()->logout();

        foreach (['technical_admin', 'finance_manager', 'stock_manager'] as $role) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $this->get(route('admin.quote.version.pdf', [$q, 1]))->assertForbidden();
            auth()->logout();
        }
        $this->get(route('admin.quote.version.pdf', [$q, 1]))->assertRedirect('/admin/login');

        $this->actingAs(User::factory()->create(['role' => 'sales_manager']));
        Livewire::test(ListQuotes::class)
            ->callAction(TestAction::make('nouvelleVersion')->table($q), data: ['lines' => [['position' => 1, 'qty' => 4, 'unit_ttc' => 2000]], 'mode' => 'retrait', 'ville' => null, 'reason' => 'Prix 4 portes', 'send' => false])
            ->assertHasNoActionErrors()->assertNotified();
        $v2 = QuoteVersion::where('quote_id', $q->id)->where('version', 2)->sole();
        $this->assertSame('9001-2', $v2->number);
        $this->assertSame(8000, $v2->total_ttc);
        $this->get(route('admin.quote.version.pdf', [$q, 2]))->assertOk();
        $this->get(route('admin.quote.version.pdf', [$q, 7]))->assertNotFound();
    }

    public function test_migration_backfills_version_one_for_quotes_issued_before_versioning(): void
    {
        file_put_contents($this->dir.'/out/Devis-8123-FAW.pdf', str_repeat('%PDF', 400));
        $q = Quote::create(['clientName' => 'Ancien client', 'clientType' => 'particulier', 'phone' => '0612345678', 'email' => 'delivered@resend.dev', 'city' => 'Rabat', 'status' => 'envoyé', 'number' => '8123', 'pdfFile' => 'Devis-8123-FAW.pdf', 'totalHt' => 3666.67, 'totalTtc' => 4400, 'transport' => 'Rabat : transport à confirmer, hors total', 'lines' => json_encode([['id' => 'CF-EI60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'category' => 'Portes coupe-feu', 'qty' => 2, 'unit' => 2200, 'total' => 4400, 'override' => false]]), 'genInput' => json_encode(['client' => 'Ancien client', 'transport' => ['mode' => 'a_confirmer', 'ville' => 'Rabat']]), 'journalInput' => '{}', 'token' => Quote::newRawToken(), 'emailStatus' => 'envoyé', 'emailMessageId' => 'legacy-id', 'emailSentAt' => now(), 'journaled' => true, 'validatedAt' => now()]);
        (require database_path('migrations/2026_11_11_170000_create_quote_versions.php'))->up();
        (require database_path('migrations/2026_11_11_170000_create_quote_versions.php'))->up(); // idempotent

        $v = QuoteVersion::where('quote_id', $q->id)->sole();
        $this->assertSame('8123', $v->number);
        $this->assertSame(4400, $v->total_ttc);
        $this->assertSame('sent', $v->email_status);
        $this->assertSame('legacy-id', $v->email_message_id);
        $this->assertSame('a_confirmer', $v->delivery['mode']);
        $this->assertSame(hash_file('sha256', $this->dir.'/out/Devis-8123-FAW.pdf'), $v->pdf_sha256);
        $this->assertSame('8123', $q->fresh()->versionNumber);
        $this->assertSame(['legacy'], QuoteVersionEmail::where('quote_version_id', $v->id)->pluck('kind')->all());
        $this->assertSame('9000', $this->counter());
    }
}
