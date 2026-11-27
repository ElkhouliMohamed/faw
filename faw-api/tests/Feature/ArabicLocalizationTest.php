<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\ContentPage;
use App\Models\Product;
use App\Models\ShippingCity;
use App\Models\ShopOrder;
use App\Models\SiteMenu;
use App\Models\SystemConfig;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ArabicLocalizationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        ShippingCity::create(['slug' => 'casablanca', 'name' => 'Casablanca', 'name_ar' => 'الدار البيضاء', 'fee' => 400, 'updatedAt' => now()]);
        Category::create([
            'slug' => 'portes-coupe-feu',
            'label' => 'Portes coupe-feu',
            'label_ar' => 'أبواب مقاومة للحريق',
            'description' => 'Portes certifiées',
            'description_ar' => 'أبواب معتمدة ومقاومة للنيران',
            'family' => 'portes-coupe-feu',
            'updatedAt' => now(),
        ]);
        Product::create([
            'id' => 'CF-AR-1',
            'slug' => 'cf-ar-1',
            'title' => 'Porte coupe-feu EI60',
            'title_ar' => 'باب مقاوم للحريق EI60',
            'description' => 'Description en français',
            'description_ar' => 'وصف باللغة العربية',
            'shortDescription' => 'Court FR',
            'shortDescription_ar' => 'قصير AR',
            'seoTitle' => 'SEO FR',
            'seoTitle_ar' => 'SEO AR',
            'price' => 3000,
            'category' => 'Portes coupe-feu',
            'availability' => 'en stock',
            'active' => true,
            'updatedAt' => now(),
        ]);
        Product::create([
            'id' => 'CF-NO-AR',
            'slug' => 'cf-no-ar',
            'title' => 'Produit sans arabe',
            'description' => 'Seulement en français',
            'price' => 1500,
            'category' => 'Portes coupe-feu',
            'availability' => 'en stock',
            'active' => true,
            'updatedAt' => now(),
        ]);
    }

    private function showPrices(): void
    {
        SystemConfig::where('name', 'shop')->first()->saveForm(['showPrices' => true]);
    }

    public function test_catalog_and_products_return_arabic_when_requested_with_french_fallback(): void
    {
        $this->showPrices();

        // 1. Default request (FR)
        $frCatalog = collect($this->getJson('/api/catalog')->assertOk()->json())->keyBy('id');
        $this->assertSame('Porte coupe-feu EI60', $frCatalog['CF-AR-1']['title']);
        $this->assertSame('Description en français', $frCatalog['CF-AR-1']['description']);

        // 2. Arabic request via ?locale=ar
        $arCatalog = collect($this->getJson('/api/catalog?locale=ar')->assertOk()->json())->keyBy('id');
        $this->assertSame('باب مقاوم للحريق EI60', $arCatalog['CF-AR-1']['title']);
        $this->assertSame('وصف باللغة العربية', $arCatalog['CF-AR-1']['description']);
        $this->assertSame('قصير AR', $arCatalog['CF-AR-1']['shortDescription']);
        // Fallback for product without Arabic translation
        $this->assertSame('Produit sans arabe', $arCatalog['CF-NO-AR']['title']);
        $this->assertSame('Seulement en français', $arCatalog['CF-NO-AR']['description']);

        // 3. Arabic request via Header X-Locale: ar
        $headerCatalog = collect($this->getJson('/api/catalog', ['X-Locale' => 'ar'])->assertOk()->json())->keyBy('id');
        $this->assertSame('باب مقاوم للحريق EI60', $headerCatalog['CF-AR-1']['title']);

        // 4. Single product endpoint
        $this->getJson('/api/products/cf-ar-1')->assertOk()->assertJsonPath('title', 'Porte coupe-feu EI60');
        $this->getJson('/api/products/cf-ar-1?locale=ar')->assertOk()->assertJsonPath('title', 'باب مقاوم للحريق EI60');

        // 5. Categories
        $categoriesFr = collect($this->getJson('/api/categories')->assertOk()->json())->keyBy('slug');
        $this->assertSame('Portes coupe-feu', $categoriesFr['portes-coupe-feu']['label']);

        $categoriesAr = collect($this->getJson('/api/categories?locale=ar')->assertOk()->json())->keyBy('slug');
        $this->assertSame('أبواب مقاومة للحريق', $categoriesAr['portes-coupe-feu']['label']);
        $this->assertSame('أبواب معتمدة ومقاومة للنيران', $categoriesAr['portes-coupe-feu']['description']);
    }

    public function test_menus_and_site_content_support_arabic_with_fallback(): void
    {
        SiteMenu::create([
            'location' => 'header',
            'title' => 'Menu principal',
            'title_ar' => 'القائمة الرئيسية',
            'items' => [
                ['label' => 'Boutique', 'label_ar' => 'المتجر', 'url' => '/produits', 'newTab' => false, 'highlight' => false],
                ['label' => 'Sans arabe', 'url' => '/contact', 'newTab' => false, 'highlight' => false],
            ],
            'active' => true,
        ]);

        $frSite = $this->getJson('/api/site')->assertOk()->json();
        $this->assertSame('Menu principal', $frSite['menus']['header']['title']);
        $this->assertSame('Boutique', $frSite['menus']['header']['items'][0]['label']);
        $this->assertSame('Sans arabe', $frSite['menus']['header']['items'][1]['label']);

        $arSite = $this->getJson('/api/site?locale=ar')->assertOk()->json();
        $this->assertSame('القائمة الرئيسية', $arSite['menus']['header']['title']);
        $this->assertSame('المتجر', $arSite['menus']['header']['items'][0]['label']);
        // Fallback to FR when label_ar not set
        $this->assertSame('Sans arabe', $arSite['menus']['header']['items'][1]['label']);
    }

    public function test_content_pages_and_home_support_arabic(): void
    {
        ContentPage::create([
            'kind' => 'page',
            'slug' => 'a-propos',
            'title' => 'À propos',
            'title_ar' => 'من نحن',
            'bodyHtml' => '<p>Texte FR</p>',
            'bodyHtml_ar' => '<p>نص عربي</p>',
            'published' => true,
        ]);

        $this->getJson('/api/content/page/a-propos')->assertOk()->assertJsonPath('title', 'À propos');
        $this->getJson('/api/content/page/a-propos?locale=ar')->assertOk()->assertJsonPath('title', 'من نحن')->assertJsonPath('bodyHtml', '<p>نص عربي</p>');
    }

    public function test_order_with_arabic_locale_saves_locale_and_sends_arabic_email(): void
    {
        $this->showPrices();
        config(['faw.resend_key' => 'test-only', 'faw.email_from' => 'FAW <test@example.test>']);
        Http::fake(['api.resend.com/*' => Http::response(['id' => 'test-msg'], 200)]);

        $orderPayload = [
            'name' => 'محمد العلمي',
            'phone' => '0612345678',
            'email' => 'client-ar@example.test',
            'city' => 'Casablanca',
            'pickup' => true,
            'items' => [['id' => 'CF-AR-1', 'qty' => 1]],
            'paymentMethod' => 'virement',
            'cgv' => true,
            'locale' => 'ar',
        ];

        $res = $this->postJson('/api/orders', $orderPayload)->assertCreated();
        $number = $res->json('number');

        $o = ShopOrder::where('number', $number)->firstOrFail();
        $this->assertSame('ar', $o->locale);

        // Check that customer email was sent in Arabic
        Http::assertSent(function ($req) {
            return $req['to'] === ['client-ar@example.test']
                && str_contains($req['subject'], 'FAW Aluminium — تم استلام الطلب')
                && str_contains($req['text'], 'لقد تم تسجيل طلبكم')
                && str_contains($req['text'], 'تحويل بنكي');
        });
    }
}
