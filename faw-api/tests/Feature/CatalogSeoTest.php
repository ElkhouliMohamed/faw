<?php

namespace Tests\Feature;

use App\Filament\Resources\Categorys\Pages\CreateCategory;
use App\Models\Category;
use App\Models\Product;
use App\Models\User;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\TestCase;

class CatalogSeoTest extends TestCase
{
    use RefreshDatabase;

    private function cat(string $slug, array $extra = []): Category
    {
        return Category::create(['slug' => $slug, 'label' => ucfirst($slug), 'family' => 'portes-coupe-feu', 'updatedAt' => now()] + $extra);
    }

    private function product(string $id, array $extra = []): Product
    {
        return Product::create(['id' => $id, 'slug' => strtolower($id), 'title' => 'Produit '.$id, 'seoTitle' => 'Produit '.$id, 'description' => 'Description', 'price' => 2200, 'category' => 'Portes', 'updatedAt' => now()] + $extra);
    }

    public function test_sales_mode_defaults_to_quote_only_and_stays_inert_on_the_public_api(): void
    {
        $this->cat('portes', ['label' => 'Portes']);
        $a = $this->product('A-1');
        $b = $this->product('B-1', ['salesMode' => 'direct']);
        $c = $this->product('C-1', ['salesMode' => 'n-importe-quoi']);
        $this->assertSame(['quote_only', 'direct', 'quote_only'], [$a->fresh()->salesMode, $b->fresh()->salesMode, $c->fresh()->salesMode]);

        $rows = collect($this->getJson('/api/catalog')->assertOk()->json())->keyBy('id');
        $strip = fn (array $r) => collect($r)->except(['id', 'slug', 'title', 'seoTitle'])->all();
        $this->assertSame($strip($rows['A-1']), $strip($rows['B-1']), 'sales mode must not change what the public site receives');
        $this->assertArrayNotHasKey('salesMode', $rows['B-1']);
        $this->assertArrayHasKey('h1', $rows['A-1']);
    }

    public function test_category_hierarchy_is_public_only_for_published_categories_and_rejects_cycles(): void
    {
        $root = $this->cat('portes');
        $child = $this->cat('portes-1-vantail', ['parentId' => $root->id, 'h1' => 'Portes 1 vantail']);
        $hidden = $this->cat('brouillon', ['parentId' => $root->id, 'active' => false]);
        $api = collect($this->getJson('/api/categories')->assertOk()->json())->keyBy('slug');
        $this->assertSame([null, $root->id], [$api['portes']['parentId'], $api['portes-1-vantail']['parentId']]);
        $this->assertSame('Portes 1 vantail', $api['portes-1-vantail']['h1']);
        $this->assertFalse($api->has('brouillon'));
        $this->assertSame([$child->id, $hidden->id], $root->descendantIds());

        foreach ([[$root, $child->id], [$root, $root->id]] as [$cat, $parent]) {
            try {
                $cat->update(['parentId' => $parent]);
                $this->fail('cycle accepted');
            } catch (ValidationException) {
            }
        }
        try {
            $root->delete();
            $this->fail('deleted a parent with sub-categories');
        } catch (ValidationException) {
        }
        $this->assertNull($root->fresh()->parentId);
    }

    public function test_filament_category_form_saves_parent_h1_and_seo_fields(): void
    {
        $root = $this->cat('portes', ['seoTitle' => 'Titre déjà pris']);
        $this->actingAs(User::factory()->create(['role' => 'catalogue_manager']));
        Livewire::test(CreateCategory::class)
            ->fillForm(['slug' => 'portes-2-vantaux', 'label' => 'Portes 2 vantaux', 'family' => 'portes-coupe-feu', 'parentId' => $root->id, 'h1' => 'Portes coupe-feu 2 vantaux', 'seoTitle' => 'Titre déjà pris', 'active' => true])
            ->call('create')
            ->assertHasFormErrors(['seoTitle' => 'unique']);
        Livewire::test(CreateCategory::class)
            ->fillForm(['slug' => 'portes-2-vantaux', 'label' => 'Portes 2 vantaux', 'family' => 'portes-coupe-feu', 'parentId' => $root->id, 'h1' => 'Portes coupe-feu 2 vantaux', 'seoTitle' => 'Portes coupe-feu 2 vantaux à Casablanca', 'active' => true])
            ->call('create')
            ->assertHasNoFormErrors();
        $c = Category::where('slug', 'portes-2-vantaux')->sole();
        $this->assertSame([$root->id, 'Portes coupe-feu 2 vantaux'], [$c->parentId, $c->h1]);
    }
}
