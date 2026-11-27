<?php

namespace Tests\Feature;

use App\Filament\Resources\Homepages\Pages\EditHomepage;
use App\Filament\Resources\SiteLayouts\Pages\EditSiteLayout;
use App\Models\ContentPage;
use App\Models\SiteMenu;
use App\Models\SystemConfig;
use App\Models\User;
use App\Services\HomeSections;
use App\Services\HomeTemplate;
use App\Services\SiteLayout;
use Database\Seeders\HomeTemplateSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\TestCase;

/** Home page built from the client's mockup: section types, validation, FR/AR, icons, old JSON, header / footer settings. */
class HomePageCmsTest extends TestCase
{
    use RefreshDatabase;

    private function invalid(array $sections, string $needle): void
    {
        try {
            HomeSections::normalize($sections);
            $this->fail('Expected a validation error containing: '.$needle);
        } catch (ValidationException $e) {
            $this->assertStringContainsString($needle, implode(' ', $e->validator->errors()->all()));
        }
    }

    private function slider(array $slide = []): array
    {
        return ['type' => 'heroSlider', 'data' => ['slides' => [$slide + ['title' => 'Titre']]]];
    }

    public function test_template_validates_and_covers_every_block_of_the_mockup(): void
    {
        $stored = HomeSections::normalize(HomeTemplate::sections());
        $this->assertSame(
            ['heroSlider', 'features', 'products', 'sectors', 'about', 'highlights', 'projects', 'process', 'cta'],
            array_column($stored, 'type'),
        );
        $this->assertCount(3, $stored[0]['data']['slides']);
        $this->assertSame(['EI₂60', 'EI₂90', 'EI₂120'], array_column($stored[0]['data']['slides'][0]['highlights'], 'text'));
        $this->assertSame('Sécurité Incendie pour Vos Bâtiments', $stored[0]['data']['slides'][0]['title']);
        $this->assertCount(4, $stored[1]['data']['items']);
        $this->assertCount(5, $stored[3]['data']['items']);
        $this->assertCount(4, $stored[7]['data']['steps']);
        // Normalising twice gives the same result (form fill -> save round trip).
        $this->assertSame($stored, HomeSections::normalize($stored));
    }

    public function test_public_payload_is_french_or_arabic_with_french_fallback_at_every_depth(): void
    {
        $sections = HomeTemplate::sections();
        $sections[0]['data']['slides'][0]['badges'][0]['line1_ar'] = '';   // no Arabic: French kept
        $sections[0]['data']['slides'][0]['eyebrow_ar'] = '   ';

        $fr = HomeSections::public($sections, 'fr');
        $ar = HomeSections::public($sections, 'ar');

        $this->assertSame('Sécurité Incendie pour Vos Bâtiments', $fr[0]['slides'][0]['title']);
        $this->assertSame('السلامة من الحريق لمبانيكم', $ar[0]['slides'][0]['title']);
        $this->assertSame('أمان معزز', $ar[1]['items'][1]['title']);
        $this->assertSame('مطابقة', $ar[0]['slides'][0]['badges'][2]['line1']);          // nested list (slides[].badges[])
        $this->assertSame('Certifiées', $ar[0]['slides'][0]['badges'][0]['line1']);      // fallback in a nested list
        $this->assertSame('Portes coupe-feu', $ar[0]['slides'][0]['eyebrow']);           // blank Arabic = French
        $this->assertSame('الاستشارة ودراسة المشروع', $ar[4]['checklist'][0]['text']);
        $this->assertStringNotContainsString('_ar"', json_encode($ar));                   // "_ar" keys are not sent
        $this->assertArrayNotHasKey('enabled', $fr[0]);

        $sections[1]['data']['enabled'] = false;
        $this->assertNotContains('features', array_column(HomeSections::public($sections, 'fr'), 'type'));
    }

    public function test_icons_are_whitelisted_and_legacy_icon_keys_still_work(): void
    {
        $this->invalid([['type' => 'features', 'data' => ['items' => [['icon' => 'skull', 'title' => 'X']]]]], 'icône inconnue');
        $this->invalid([$this->slider(['badges' => [['icon' => '<script>', 'line1' => 'A']]])], 'icône inconnue');

        $ok = HomeSections::normalize([['type' => 'features', 'data' => ['items' => [['icon' => 'flame', 'title' => 'Feu'], ['icon' => '', 'title' => 'Sans icône']]]]]);
        $this->assertSame(['flame', ''], array_column($ok[0]['data']['items'], 'icon'));

        // Old "usps" section: old keys mapped to lucide names, unknown icons replaced (as before), never rejected.
        $usps = HomeSections::normalize([['type' => 'usps', 'data' => ['items' => [['icon' => 'badge', 'title' => 'A'], ['icon' => 'file', 'title' => 'B'], ['icon' => 'nope', 'title' => 'C'], ['icon' => 'truck', 'title' => 'D']]]]]);
        $this->assertSame(['badge-check', 'file-text', 'badge-check', 'truck'], array_column($usps[0]['data']['items'], 'icon'));
    }

    public function test_required_fields_limits_links_and_images_are_validated(): void
    {
        $this->invalid([['type' => 'heroSlider', 'data' => ['slides' => []]]], 'au moins 1');
        $this->invalid([$this->slider(['title' => ''])], 'title');
        $this->invalid([$this->slider(['title' => str_repeat('a', 141)])], 'title');
        $this->invalid([$this->slider(['primaryUrl' => 'javascript:alert(1)'])], 'primary');
        $this->invalid([$this->slider(['image' => 'https://example.com/photo.jpg'])], 'image');
        $this->invalid([$this->slider(['image' => '/storage/../../.env.png'])], 'image');
        $this->invalid([$this->slider(['highlights' => array_fill(0, 7, ['text' => 'EI60'])])], '6 éléments maximum');
        $this->invalid([['type' => 'features', 'data' => ['items' => array_fill(0, 9, ['title' => 'X'])]]], '8 éléments maximum');
        $this->invalid([['type' => 'sectors', 'data' => ['items' => [['label' => '']]]]], 'label');
        $this->invalid([['type' => 'highlights', 'data' => ['title' => '']]], 'title');
        $this->invalid([['type' => 'products', 'data' => ['anchor' => 'Nos Produits!']]], 'anchor');
        $this->invalid([['type' => 'cta', 'data' => ['title' => 'CTA', 'phone' => 'call me']]], 'phone');
        $this->invalid([['type' => 'cta', 'data' => ['title' => 'CTA', 'whatsappNumber' => '+212 600']]], 'whatsapp');
        $this->invalid([['type' => 'unknown', 'data' => []]], 'Type de section invalide');

        // A file just uploaded in Filament (relative path on the public disk) is stored as its public URL.
        $s = HomeSections::normalize([$this->slider(['image' => 'media/accueil/abc123.webp'])]);
        $this->assertSame('/storage/media/accueil/abc123.webp', $s[0]['data']['slides'][0]['image']);
        $s = HomeSections::normalize([['type' => 'about', 'data' => ['image' => ['uuid-1' => 'media/accueil/a.jpg']]]]);
        $this->assertSame('/storage/media/accueil/a.jpg', $s[0]['data']['image']);

        // Defaults: autoplay on, interval clamped, CTA phone off unless chosen.
        $s = HomeSections::normalize([['type' => 'heroSlider', 'data' => ['interval' => 99, 'slides' => [['title' => 'T']]]], ['type' => 'cta', 'data' => ['title' => 'C']]]);
        $this->assertTrue($s[0]['data']['autoplay']);
        $this->assertSame(15, $s[0]['data']['interval']);
        $this->assertFalse($s[1]['data']['showPhone']);
        $this->assertTrue($s[1]['data']['showWhatsapp']);
    }

    public function test_home_json_saved_by_the_previous_version_still_validates_and_renders(): void
    {
        $old = [
            ['type' => 'hero', 'data' => ['enabled' => true, 'eyebrow' => 'FAW · Casablanca', 'title' => 'Portes coupe-feu', 'subtitle' => 'Texte', 'image' => '/images/products/v7-2/CF-EI60-100-photo.jpg', 'imageAlt' => 'Porte', 'primaryLabel' => 'Demander un devis', 'primaryUrl' => '/devis', 'secondaryLabel' => 'Voir', 'secondaryUrl' => '/produits/portes-coupe-feu', 'showContact' => true]],
            ['type' => 'categories', 'data' => ['enabled' => true, 'title' => 'Nos autres produits', 'subtitle' => '', 'slugs' => ['galandage', 'incendie']]],
            ['type' => 'usps', 'data' => ['enabled' => true, 'title' => 'Pourquoi FAW', 'subtitle' => '', 'items' => [['icon' => 'warehouse', 'title' => 'Retrait au dépôt', 'text' => 'Gratuit']]]],
            ['type' => 'products', 'data' => ['enabled' => false, 'title' => 'Produits phares', 'subtitle' => '', 'ids' => ['CF-EI60-90'], 'linkLabel' => 'Tout voir', 'linkUrl' => '/produits']],
            ['type' => 'cta', 'data' => ['enabled' => true, 'title' => 'Un chantier ?', 'text' => 'Écrivez-nous', 'label' => 'Demander un devis', 'url' => '/devis', 'showWhatsapp' => true]],
            ['type' => 'blog', 'data' => ['enabled' => true, 'title' => 'Conseils', 'count' => 3]],
        ];
        $stored = HomeSections::normalize(json_encode($old));
        $this->assertSame(array_column($old, 'type'), array_column($stored, 'type'));
        $this->assertSame('/images/products/v7-2/CF-EI60-100-photo.jpg', $stored[0]['data']['image']);
        $this->assertSame(['galandage', 'incendie'], $stored[1]['data']['slugs']);
        $this->assertSame('/devis', $stored[4]['data']['url']);
        $this->assertSame([], $stored[3]['data']['cards']);   // new list fields get empty defaults

        $public = HomeSections::public($old, 'ar');
        $this->assertSame(['hero', 'categories', 'usps', 'cta', 'blog'], array_column($public, 'type'));
        $this->assertSame('Portes coupe-feu', $public[0]['title']);

        // Flat landing-page format (home created before the section builder).
        $flat = HomeSections::normalize([['type' => 'hero', 'title' => 'Ancien', 'ctaLabel' => 'Devis', 'ctaUrl' => '/devis']]);
        $this->assertSame('Devis', $flat[0]['data']['primaryLabel']);
        $this->assertTrue(HomeSections::isLegacy([['type' => 'hero', 'title' => 'Ancien']]));

        // Malformed stored JSON (array where a string is expected) is dropped or rejected, never a PHP error (500).
        $odd = HomeSections::normalize([['type' => 'features', 'data' => ['items' => [['icon' => ['x'], 'title' => 'A']]]], ['type' => 'about', 'data' => ['image' => [['nested']]]]]);
        $this->assertSame('', $odd[0]['data']['items'][0]['icon']);
        $this->assertSame('', $odd[1]['data']['image']);
        $this->assertSame([], HomeSections::public([['type' => ['hero'], 'data' => []]], 'fr'));

        ContentPage::create(['kind' => 'home', 'slug' => 'accueil', 'title' => 'Accueil', 'published' => true, 'blocks' => $old]);
        $this->getJson('/api/home')->assertOk()->assertJsonPath('home.sections.0.type', 'hero')->assertJsonPath('home.sections.3.label', 'Demander un devis');
    }

    public function test_api_serves_the_model_until_a_home_is_published_then_the_saved_sections(): void
    {
        $this->getJson('/api/home')->assertOk()
            ->assertJsonPath('home.template', true)
            ->assertJsonPath('home.sections.0.type', 'heroSlider')
            ->assertJsonPath('home.sections.0.slides.0.title', 'Sécurité Incendie pour Vos Bâtiments');
        $this->getJson('/api/home?locale=ar')->assertOk()->assertJsonPath('home.sections.0.slides.0.title', 'السلامة من الحريق لمبانيكم');

        (new HomeTemplateSeeder)->run();
        (new HomeTemplateSeeder)->run(); // idempotent
        $this->assertSame(1, ContentPage::where('kind', 'home')->count());
        $this->assertSame(4, SiteMenu::count());

        $home = ContentPage::where('kind', 'home')->first();
        $blocks = $home->blocks;
        $blocks[0]['data']['slides'][0]['title'] = 'Titre modifié';
        $home->update(['blocks' => $blocks]);
        $json = $this->getJson('/api/home')->assertOk()->json('home');
        $this->assertArrayNotHasKey('template', $json);
        $this->assertSame('Titre modifié', $json['sections'][0]['slides'][0]['title']);

        $this->expectException(ValidationException::class);
        $blocks[1]['data']['items'][0]['icon'] = 'not-an-icon';
        $home->update(['blocks' => $blocks]);
    }

    public function test_site_api_exposes_header_footer_settings_menus_dropdown_and_youtube(): void
    {
        $site = $this->getJson('/api/site')->assertOk()->json();
        $this->assertSame('Livraison & installation sur tout le Maroc', $site['layout']['topbar'][0]['text']);
        $this->assertSame('truck', $site['layout']['topbar'][0]['icon']);
        $this->assertSame('/devis', $site['layout']['headerCtaUrl']);
        $this->assertArrayNotHasKey('footerText_ar', $site['layout']);
        $this->assertSame('التوصيل والتركيب في جميع أنحاء المغرب', $this->getJson('/api/site?locale=ar')->json('layout.topbar.0.text'));

        $layout = SystemConfig::firstOrCreate(['name' => 'layout'], ['value' => SiteLayout::defaults()]);
        $layout->saveForm(['topbar' => [['icon' => 'phone', 'text' => 'Appelez-nous', 'text_ar' => '', 'url' => 'tel:+212522000000']], 'footerText' => 'Texte FR', 'footerText_ar' => 'نص']);
        $this->assertSame('Appelez-nous', $this->getJson('/api/site?locale=ar')->json('layout.topbar.0.text')); // fallback
        $this->assertSame('نص', $this->getJson('/api/site?locale=ar')->json('layout.footerText'));
        $this->assertSame('/devis', $this->getJson('/api/site')->json('layout.headerCtaUrl'));         // untouched keys kept

        foreach ([['topbar' => [['icon' => 'skull', 'text' => 'X']]], ['headerCtaUrl' => 'javascript:alert(1)'], ['topbar' => array_fill(0, 5, ['text' => 'X'])]] as $bad) {
            try {
                $layout->fresh()->saveForm($bad);
                $this->fail('Invalid layout saved: '.json_encode($bad));
            } catch (ValidationException) {
            }
        }

        SystemConfig::where('name', 'social')->first()->saveForm(['youtube' => 'https://www.youtube.com/@faw', 'hours' => 'Lun – Sam : 08h00 – 18h00', 'hours_ar' => 'الإثنين – السبت']);
        $this->assertSame('https://www.youtube.com/@faw', $this->getJson('/api/site')->json('socials.youtube'));
        $this->assertSame('الإثنين – السبت', $this->getJson('/api/site?locale=ar')->json('contact.hours'));
        $this->assertSame('Lun – Sam : 08h00 – 18h00', $this->getJson('/api/site')->json('contact.hours'));

        (new HomeTemplateSeeder)->run();
        $header = $this->getJson('/api/site?locale=ar')->json('menus.header.items');
        $this->assertSame('المنتجات', $header[1]['label']);
        $this->assertSame('أبواب مقاومة للحريق', $header[1]['children'][0]['label']);
        $this->assertSame('/produits/portes-coupe-feu', $header[1]['children'][0]['url']);

        $this->expectException(ValidationException::class);
        SiteMenu::where('location', 'header')->first()->update(['items' => [['label' => 'P', 'url' => '/p', 'children' => [['label' => 'X', 'url' => 'javascript:x']]]]]);
    }

    public function test_back_office_edits_the_home_and_header_footer_and_can_reset_to_the_model(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'super_admin']));
        (new HomeTemplateSeeder)->run();
        $home = ContentPage::where('kind', 'home')->first();

        $this->get('/admin/homepages/'.$home->getRouteKey().'/edit')->assertOk()->assertSee('Bannière défilante');
        $this->get('/admin/site-layout')->assertOk()->assertSee('Bandeau du haut');

        // Save without changes: images shipped with the site (/images/...) survive the upload field round trip.
        Livewire::test(EditHomepage::class, ['record' => $home->getRouteKey()])->call('save')->assertHasNoFormErrors();
        $saved = $home->fresh()->blocks;
        $this->assertSame('/images/alt/CF-EI60-1V-photo-posee.jpg', $saved[0]['data']['slides'][0]['image']);
        $this->assertSame(HomeSections::normalize(HomeTemplate::sections()), $saved);

        $blocks = $saved;
        $blocks[0]['data']['slides'] = [$blocks[0]['data']['slides'][0]];
        $home->update(['blocks' => $blocks]);
        Livewire::test(EditHomepage::class, ['record' => $home->getRouteKey()])->callAction('resetTemplate');
        $this->assertCount(3, $home->fresh()->blocks[0]['data']['slides']);

        Livewire::test(EditSiteLayout::class)
            ->set('data.fields.footerText', 'Nouveau texte du pied de page')
            ->call('save')->assertHasNoFormErrors();
        $this->assertSame('Nouveau texte du pied de page', $this->getJson('/api/site')->json('layout.footerText'));
    }
}
