<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Support\DoorHeight;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DoorHeightBackfillTest extends TestCase
{
    use RefreshDatabase;

    public function test_backfill_stores_verified_height_and_skips_unknown_or_existing(): void
    {
        Product::create(['id' => 'CF-EI60-100', 'slug' => 'cf-ei60-100', 'title' => 'Porte coupe-feu EI60 100 cm', 'seoTitle' => '', 'description' => 'Dimensions : 100 × 212,5 cm, 1 vantail.', 'price' => 1, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => '', 'description' => 'Dimensions : 90 × 212,5 cm, 1 vantail.', 'attributes' => json_encode(['hauteur' => '200'], JSON_UNESCAPED_UNICODE), 'price' => 1, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        Product::create(['id' => 'CF-UNKNOWN', 'slug' => 'cf-unknown', 'title' => 'Porte coupe-feu sans cote', 'seoTitle' => '', 'description' => 'Porte coupe-feu en acier galvanisé.', 'price' => 1, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        Product::create(['id' => 'GAL-800', 'slug' => 'gal-800', 'title' => 'Châssis galandage 80 cm', 'seoTitle' => '', 'description' => 'Passage : 800 × 2100 mm.', 'price' => 1, 'category' => 'Portes coulissantes encastrables', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);

        $this->assertSame(1, DoorHeight::backfill());
        $this->assertSame(0, DoorHeight::backfill());

        $this->assertSame('212,5', json_decode(Product::find('CF-EI60-100')->attributes, true)['hauteur']);
        $this->assertSame('200', json_decode(Product::find('CF-EI60-90')->attributes, true)['hauteur']);
        $this->assertSame([], json_decode(Product::find('CF-UNKNOWN')->attributes, true) ?: []);
        $this->assertSame([], json_decode(Product::find('GAL-800')->attributes, true) ?: []);
        $this->assertDatabaseHas('Attribute', ['key' => 'hauteur', 'label' => 'Hauteur', 'unit' => 'cm']);

        $row = collect($this->getJson('/api/catalog')->assertOk()->json())->firstWhere('id', 'CF-EI60-100');
        $this->assertSame('212,5', json_decode($row['attributes'], true)['hauteur']);
        $this->assertArrayNotHasKey('price', $row);
    }
}
