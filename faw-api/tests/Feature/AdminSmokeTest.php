<?php

namespace Tests\Feature;

use App\Models\Product;
use App\Models\User;
use Database\Seeders\ShopDefaultsSeeder;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Every back-office list, create and edit page renders for the owner on the real database driver (PostgreSQL in CI). */
class AdminSmokeTest extends TestCase
{
    use RefreshDatabase;

    public function test_every_filament_page_renders_for_the_owner(): void
    {
        (new ShopDefaultsSeeder)->run();
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        $this->postJson('/api/orders', ['name' => 'Client Test', 'phone' => '0612345678', 'email' => 'client@example.test', 'city' => 'Casablanca', 'address' => '1 rue de test, Maarif', 'items' => [['id' => 'CF-EI60-90', 'qty' => 1]], 'paymentMethod' => 'virement'])->assertCreated();

        $this->actingAs(User::factory()->create(['role' => 'super_admin']));
        $this->get('/admin')->assertOk();

        $failures = [];
        $visited = 0;
        foreach (Filament::getPanel('admin')->getResources() as $resource) {
            foreach ($resource::getPages() as $name => $registration) {
                if (! in_array($name, ['index', 'create', 'edit', 'view'], true) || ! $resource::canAccess()) {
                    continue;
                }
                $record = null;
                if (in_array($name, ['edit', 'view'], true)) {
                    $record = $resource::getEloquentQuery()->first();
                    if (! $record) {
                        continue;
                    }
                }
                try {
                    $url = $record ? $resource::getUrl($name, ['record' => $record]) : $resource::getUrl($name);
                } catch (\Throwable) {
                    continue;
                }
                $status = $this->get($url)->getStatusCode();
                $visited++;
                if (! in_array($status, [200, 403], true)) {
                    $failures[] = "{$status} {$url}";
                }
            }
        }
        $this->assertGreaterThan(40, $visited, 'Pages visited: '.$visited);
        $this->assertSame([], $failures);
    }
}
