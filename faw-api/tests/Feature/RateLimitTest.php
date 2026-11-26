<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RateLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalogue_reads_allow_1200_per_minute(): void
    {
        foreach (['/api/catalog', '/api/products', '/api/categories'] as $url) {
            $this->getJson($url)->assertOk()->assertHeader('X-RateLimit-Limit', '1200');
        }
        for ($i = 0; $i < 300; $i++) {
            $this->getJson('/api/catalog')->assertOk();
        }
    }

    public function test_quote_and_order_writes_keep_10_per_minute(): void
    {
        // corps vide : rejeté par la validation, aucun numéro de devis réservé
        for ($i = 0; $i < 10; $i++) {
            $this->assertNotSame(429, $this->postJson('/api/quotes', [])->status());
        }
        $this->postJson('/api/quotes', [])->assertStatus(429);
        $this->postJson('/api/orders', [])->assertStatus(429);
    }

    public function test_catalogue_traffic_does_not_consume_the_quote_budget(): void
    {
        for ($i = 0; $i < 130; $i++) {
            $this->getJson('/api/catalog')->assertOk();
        }
        $this->assertNotSame(429, $this->postJson('/api/quotes', [])->status());
    }
}
