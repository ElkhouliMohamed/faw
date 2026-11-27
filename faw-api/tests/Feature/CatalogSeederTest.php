<?php

namespace Tests\Feature;

use App\Models\Product;
use Database\Seeders\CatalogSeeder;
use Database\Seeders\ShopDefaultsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CatalogSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_seeder_adds_the_real_catalogue_once_and_never_overwrites_edits(): void
    {
        $this->seed(ShopDefaultsSeeder::class);
        $this->seed(CatalogSeeder::class);

        $this->assertSame(29, Product::count());
        $door = Product::findOrFail('CF-EI60-80');
        $this->assertSame(2200, $door->price);
        $this->assertSame('Portes coupe-feu', $door->category);
        $this->assertSame('direct', $door->salesMode);
        $this->assertTrue($door->active);

        $door->update(['price' => 2500, 'title' => 'Titre modifié']);
        $this->seed(CatalogSeeder::class);

        $this->assertSame(29, Product::count());
        $this->assertSame(2500, Product::findOrFail('CF-EI60-80')->price);
        $this->assertSame('Titre modifié', Product::findOrFail('CF-EI60-80')->title);

        $this->getJson('/api/products/cf-ei60-80')->assertOk();
    }
}
