<?php

namespace Tests\Feature;

use App\Models\ContentPage;
use App\Models\Product;
use App\Models\User;
use App\Services\ClaudeService;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class ClaudeAiHelperTest extends TestCase
{
    public function test_claude_service_throws_exception_when_key_is_missing(): void
    {
        config(['services.anthropic.key' => null]);
        putenv('ANTHROPIC_API_KEY=');

        $this->assertFalse(ClaudeService::isConfigured());

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Clé API Claude (ANTHROPIC_API_KEY) non configurée.');

        ClaudeService::generateProductPackage([
            'title' => 'Porte coupe-feu EI60',
        ]);
    }

    public function test_claude_service_generates_product_package_with_faked_http(): void
    {
        config(['services.anthropic.key' => 'sk-ant-test-key-12345']);

        Http::fake([
            'https://api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'type' => 'text',
                        'text' => json_encode([
                            'shortDescription' => 'Porte coupe-feu EI60 haute résistance certifiée.',
                            'description' => 'Description détaillée de la porte coupe-feu fabriquée pour les professionnels à Casablanca.',
                            'seoTitle' => 'Porte coupe-feu EI60 Casablanca | FAW',
                            'seoDescription' => 'Achetez votre porte coupe-feu EI60 certifiée à Casablanca au meilleur prix.',
                            'title_ar' => 'باب مقاوم للحريق EI60',
                            'shortDescription_ar' => 'باب مقاوم للحريق معتمد عالي الجودة.',
                            'description_ar' => 'وصف تفصيلي للباب المقاوم للحريق المصنع للمهنيين في الدار البيضاء.',
                            'seoTitle_ar' => 'باب مقاوم للحريق EI60 الدار البيضاء | فاو',
                            'seoDescription_ar' => 'شراء باب مقاوم للحريق معتمد بالدار البيضاء.',
                            'faq' => [
                                ['q' => 'Quelle est la durée de résistance ?', 'a' => 'Cette porte résiste 60 minutes au feu.'],
                            ],
                        ]),
                    ],
                ],
            ], 200),
        ]);

        $result = ClaudeService::generateProductPackage([
            'title' => 'Porte coupe-feu EI60 90 cm',
            'category' => 'Portes coupe-feu',
            'notes' => '1 vantail, acier galva, norme NF',
        ]);

        $this->assertEquals('Porte coupe-feu EI60 haute résistance certifiée.', $result['shortDescription']);
        $this->assertEquals('باب مقاوم للحريق EI60', $result['title_ar']);
        $this->assertEquals('Porte coupe-feu EI60 Casablanca | FAW', $result['seoTitle']);
        $this->assertCount(1, $result['faq']);
    }

    public function test_claude_service_generates_blog_post_with_faked_http(): void
    {
        config(['services.anthropic.key' => 'sk-ant-test-key-12345']);

        Http::fake([
            'https://api.anthropic.com/v1/messages' => Http::response([
                'content' => [
                    [
                        'type' => 'text',
                        'text' => json_encode([
                            'excerpt' => 'Guide complet sur la réglementation incendie au Maroc en 2026.',
                            'bodyHtml' => '<h2>Règles applicables</h2><p>Tous les établissements recevant du public doivent respecter les normes coupe-feu.</p>',
                            'seoTitle' => 'Guide Sécurité Incendie Maroc 2026 | FAW',
                            'seoDescription' => 'Tout savoir sur les portes coupe-feu et la réglementation incendie au Maroc.',
                            'title_ar' => 'دليل السلامة من الحرائق في المغرب 2026',
                            'excerpt_ar' => 'دليل شامل حول قوانين السلامة من الحرائق في المغرب.',
                            'bodyHtml_ar' => '<p dir="rtl">يجب على جميع المنشآت احترام معايير مقاومة الحريق.</p>',
                            'seoTitle_ar' => 'دليل السلامة من الحرائق 2026 | فاو',
                            'seoDescription_ar' => 'كل ما يجب معرفته عن الأبواب المقاومة للحريق في المغرب.',
                        ]),
                    ],
                ],
            ], 200),
        ]);

        $result = ClaudeService::generateBlogPost([
            'title' => 'Guide de la sécurité incendie',
            'outline' => 'Normes ERP au Maroc, différences EI30 et EI60',
        ]);

        $this->assertEquals('Guide complet sur la réglementation incendie au Maroc en 2026.', $result['excerpt']);
        $this->assertEquals('دليل السلامة من الحرائق في المغرب 2026', $result['title_ar']);
        $this->assertStringContainsString('Règles applicables', $result['bodyHtml']);
    }

    public function test_claude_service_handles_api_failure(): void
    {
        config(['services.anthropic.key' => 'sk-ant-test-key-12345']);

        Http::fake([
            'https://api.anthropic.com/v1/messages' => Http::response([
                'error' => ['message' => 'Rate limit exceeded on Anthropic servers'],
            ], 429),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Rate limit exceeded on Anthropic servers');

        ClaudeService::generateProductPackage([
            'title' => 'Porte coupe-feu EI60',
        ]);
    }
}
