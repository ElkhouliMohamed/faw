<?php

namespace Tests\Feature;

use App\Console\Commands\FillProductContent;
use App\Filament\Resources\Products\ProductResource;
use App\Models\Product;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductContentTest extends TestCase
{
    use RefreshDatabase;

    private function door(): Product
    {
        return Product::create(['id' => 'CF-EI60-80', 'slug' => 'cf-ei60-80', 'title' => 'Porte coupe-feu EI60 80 cm', 'seoTitle' => '', 'description' => 'Porte coupe-feu EI60, acier galvanisé. Dimensions : 80 × 212,5 cm, 1 vantail. Prix TTC 2 200 DH.', 'price' => 2200, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
    }

    public function test_catalog_exposes_fiche_fields_and_hides_empty_ones(): void
    {
        $this->door()->update(['details' => 'Texte', 'datasheet' => '/storage/fiches-techniques/a.pdf']);
        $p = collect($this->getJson('/api/catalog')->assertOk()->json())->firstWhere('id', 'CF-EI60-80');
        $this->assertSame('Texte', $p['details']);
        $this->assertNull($p['installationGuide']);
        $this->assertSame('/storage/fiches-techniques/a.pdf', $p['datasheet']);
    }

    public function test_uploaded_datasheet_maps_to_public_path_and_blank_clears(): void
    {
        $data = ProductResource::photo(['datasheetUpload' => 'fiches-techniques/x.pdf', 'details' => '', 'installationGuide' => ' ']);
        $this->assertSame('/storage/fiches-techniques/x.pdf', $data['datasheet']);
        $this->assertArrayNotHasKey('datasheetUpload', $data);
        $this->assertNull($data['details']);
        $this->assertNull($data['installationGuide']);
    }

    public function test_fill_command_uses_catalog_facts_and_never_overwrites(): void
    {
        $p = $this->door();
        $this->assertStringContainsString('80 × 212,5 cm, 1 vantail', FillProductContent::details($p));
        $p->update(['details' => 'Saisi par l\'équipe']);
        $this->artisan('faw:product-content')->assertExitCode(0);
        $this->assertSame('Saisi par l\'équipe', $p->fresh()->details);
        $this->assertNull($p->fresh()->installationGuide);
    }

    public function test_maintenance_guide_upload_maps_to_public_path_and_is_exposed(): void
    {
        $data = ProductResource::photo(['maintenanceGuideUpload' => 'guides-pose-entretien/g.pdf']);
        $this->assertSame('/storage/guides-pose-entretien/g.pdf', $data['maintenanceGuide']);
        $this->assertArrayNotHasKey('maintenanceGuideUpload', $data);
        $this->assertNull(ProductResource::photo(['maintenanceGuide' => ''])['maintenanceGuide']);
        $this->door()->update(['maintenanceGuide' => '/storage/guides-pose-entretien/g.pdf']);
        $p = collect($this->getJson('/api/catalog')->assertOk()->json())->firstWhere('id', 'CF-EI60-80');
        $this->assertSame('/storage/guides-pose-entretien/g.pdf', $p['maintenanceGuide']);
    }

    public function test_filament_product_form_shows_both_documents(): void
    {
        $this->actingAs(\App\Models\User::factory()->create(['role' => 'admin']));
        $door = $this->door();
        $door->update(['datasheet' => '/storage/fiches-techniques/f.pdf', 'maintenanceGuide' => '/storage/guides-pose-entretien/faw-portes-coupe-feu-guide-pose-entretien.pdf']);
        \Livewire\Livewire::test(\App\Filament\Resources\Products\Pages\ManageProducts::class)
            ->mountAction(\Filament\Actions\Testing\TestAction::make('edit')->table($door))
            ->assertFormFieldExists('datasheetUpload', 'mountedActionSchema0', fn ($f) => $f->getLabel() === 'Fiche technique (PDF)')
            ->assertFormFieldExists('maintenanceGuideUpload', 'mountedActionSchema0', fn ($f) => $f->getLabel() === 'Guide de pose & entretien (PDF)')
            ->assertFormFieldExists('maintenanceGuide', 'mountedActionSchema0', fn ($f) => $f->getLabel() === 'Guide de pose & entretien actuel')
            ->assertActionDataSet(['datasheet' => '/storage/fiches-techniques/f.pdf', 'maintenanceGuide' => '/storage/guides-pose-entretien/faw-portes-coupe-feu-guide-pose-entretien.pdf']);
    }
}
