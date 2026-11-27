<?php

namespace Tests\Feature;

use App\Models\LandingPage;
use App\Models\SystemConfig;
use Tests\TestCase;

class LocalSeoAndTrackingTest extends TestCase
{
    public function test_gtm_and_pixel_can_be_configured_in_system_config(): void
    {
        $config = SystemConfig::where('name', 'integrations')->first();
        $config->saveForm([
            'gtmEnabled' => true,
            'gtmId' => 'GTM-TEST1234',
            'pixelEnabled' => true,
            'pixelId' => '722847436891309',
        ]);

        $response = $this->getJson('/api/site-config');
        $response->assertOk()
            ->assertJsonPath('integrations.gtmEnabled', true)
            ->assertJsonPath('integrations.gtmId', 'GTM-TEST1234')
            ->assertJsonPath('integrations.pixelEnabled', true)
            ->assertJsonPath('integrations.pixelId', '722847436891309');
    }

    public function test_invalid_gtm_id_is_rejected(): void
    {
        $config = SystemConfig::where('name', 'integrations')->first();
        $config->saveForm([
            'gtmEnabled' => true,
            'gtmId' => 'INVALID_GTM_FORMAT',
        ]);

        $response = $this->getJson('/api/site-config');
        $response->assertOk()
            ->assertJsonPath('integrations.gtmId', null);
    }

    public function test_landing_page_serves_french_and_arabic_translations(): void
    {
        LandingPage::where('slug', 'porte-coupe-feu-casablanca')->delete();

        LandingPage::create([
            'slug' => 'porte-coupe-feu-casablanca',
            'title' => 'Porte coupe-feu à Casablanca',
            'title_ar' => 'أبواب مقاومة للحريق في الدار البيضاء',
            'seoTitle' => 'Porte coupe-feu Casablanca | FAW Aluminium',
            'seoTitle_ar' => 'أبواب مقاومة للحريق بالدار البيضاء | فاو ألمنيوم',
            'seoDescription' => 'Fabricant et installateur de portes coupe-feu EI60 à Casablanca et partout au Maroc.',
            'seoDescription_ar' => 'مصنع ومركب أبواب مقاومة للحريق في الدار البيضاء وجميع مدن المغرب.',
            'blocks' => json_encode([
                ['type' => 'text', 'title' => 'Présentation', 'body' => 'Spécialiste de la menuiserie à Casablanca.']
            ]),
            'published' => true,
        ]);

        // Default / French
        $frResponse = $this->getJson('/api/shop/landings/porte-coupe-feu-casablanca');
        $frResponse->assertOk()
            ->assertJsonPath('title', 'Porte coupe-feu à Casablanca')
            ->assertJsonPath('seoTitle', 'Porte coupe-feu Casablanca | FAW Aluminium');

        // Arabic
        $arResponse = $this->getJson('/api/shop/landings/porte-coupe-feu-casablanca?locale=ar');
        $arResponse->assertOk()
            ->assertJsonPath('title', 'أبواب مقاومة للحريق في الدار البيضاء')
            ->assertJsonPath('seoTitle', 'أبواب مقاومة للحريق بالدار البيضاء | فاو ألمنيوم');
    }
}
