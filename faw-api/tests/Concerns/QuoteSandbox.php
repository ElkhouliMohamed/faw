<?php

namespace Tests\Concerns;

use App\Models\Category;
use App\Models\Product;
use App\Models\Quote;
use App\Models\ShippingCity;
use App\Services\QuoteService;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

/** Isolated copy of the Meta Closer generator, counter (starts at 9000) and journal under /tmp. */
trait QuoteSandbox
{
    protected string $dir;

    protected string $rawToken = '';

    protected function setUpQuoteSandbox(): void
    {
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

    protected function tearDownQuoteSandbox(): void
    {
        if (isset($this->dir)) {
            File::deleteDirectory($this->dir);
        }
    }

    protected function enableMail(): void
    {
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
    }

    protected function submitQuote(int $qty = 1, bool $pickup = true): Quote
    {
        $this->rawToken = $this->postJson('/api/quotes', ['name' => 'Client test local', 'phone' => '0612345678', 'email' => 'delivered@resend.dev', 'city' => 'Casablanca', 'pickup' => $pickup, 'items' => [['id' => 'CF-EI60-90', 'qty' => $qty]]])->assertCreated()->json('token');

        return Quote::latest('id')->firstOrFail();
    }

    protected function validatedQuote(int $qty = 1, bool $pickup = true): Quote
    {
        $q = $this->submitQuote($qty, $pickup);
        app(QuoteService::class)->validate($q);

        return $q->fresh();
    }

    protected function counterValue(): string
    {
        return trim(file_get_contents($this->dir.'/devis/compteur-devis.txt'));
    }

    /** Last 6-digit code e-mailed through the faked Resend API. */
    protected function lastOtp(): ?string
    {
        $code = null;
        foreach (Http::recorded() as [$request]) {
            if (str_contains((string) ($request['subject'] ?? ''), 'Code de confirmation') && preg_match('/ : (\d{6})\n/', (string) $request['text'], $m)) {
                $code = $m[1];
            }
        }

        return $code;
    }
}
