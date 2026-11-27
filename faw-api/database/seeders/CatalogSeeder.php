<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * FAW's real starting catalogue (29 products: fire doors, sliding doors, automation, fire equipment)
 * from database/data/products.json. Idempotent: only products whose id is missing are added; products
 * already in the database (edited in Filament) are never overwritten.
 *
 *   php artisan db:seed --class=CatalogSeeder --force
 */
class CatalogSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('data/products.json');
        $items = json_decode((string) @file_get_contents($path), true);
        if (! is_array($items)) {
            throw new RuntimeException("Catalogue introuvable ou invalide : {$path}");
        }

        $added = 0;
        foreach (array_values($items) as $i => $p) {
            if (! is_array($p) || empty($p['id']) || Product::whereKey($p['id'])->exists()) {
                continue;
            }
            $description = (string) ($p['description'] ?? '');
            Product::create([
                'id' => (string) $p['id'],
                'slug' => (string) ($p['slug'] ?? Str::slug($p['id'])),
                'title' => (string) $p['title'],
                'seoTitle' => (string) ($p['seoTitle'] ?? $p['title']),
                'description' => $description,
                'price' => (int) ($p['price'] ?? 0),
                'category' => (string) $p['category'],
                'brand' => (string) ($p['brand'] ?? 'FAW Aluminium'),
                'image' => $p['image'] ?? null,
                'availability' => 'en stock',
                'active' => true,
                'salesMode' => 'direct',
                'sortOrder' => $i,
                'metaTitle' => (string) ($p['seoTitle'] ?? $p['title']),
                'metaDescription' => Str::limit($description, 155, '…'),
                'createdAt' => now(),
                'updatedAt' => now(),
            ]);
            $added++;
        }

        $this->command?->info("Catalogue : {$added} produit(s) ajouté(s), ".(count($items) - $added).' déjà présent(s).');
    }
}
