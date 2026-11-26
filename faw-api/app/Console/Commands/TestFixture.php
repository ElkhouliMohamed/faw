<?php

namespace App\Console\Commands;

use App\Models\Attribute;
use App\Models\Badge;
use App\Models\Bundle;
use App\Models\ContentPage;
use App\Models\Coupon;
use App\Models\LandingPage;
use App\Models\Popup;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Redirect;
use Database\Seeders\ShopDefaultsSeeder;
use Illuminate\Console\Command;

class TestFixture extends Command
{
    protected $signature = 'faw:test-fixture';

    protected $description = 'Catalogue synthétique pour le test HTTP isolé (base de test seulement)';

    public function handle(): int
    {
        if (! app()->environment('testing') || ! self::isolatedTestDatabase()) {
            $this->error('Réservé à une base de test isolée (PostgreSQL dont le nom finit par _test, ou SQLite dans /tmp).');

            return 1;
        }
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm · illustration non contractuelle', 'price' => 2200, 'category' => 'Portes coupe-feu', 'image' => '/images/products/CF-EI60-90.jpg', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        (new ShopDefaultsSeeder)->run();

        $badge = Badge::create(['label' => 'Repère HTTP', 'tone' => 'neutral', 'active' => true]);
        Attribute::create(['key' => 'http-largeur', 'label' => 'Largeur HTTP', 'unit' => 'cm', 'showInSpecs' => true, 'active' => true]);
        Product::whereKey('CF-EI60-90')->first()->update(['badges' => (string) $badge->id, 'attributes' => json_encode(['http-largeur' => '90'])]);
        Promotion::create(['name' => 'Offre HTTP', 'scope' => 'product', 'targets' => 'CF-EI60-90', 'kind' => 'percent', 'value' => 10, 'active' => true]);
        Coupon::create(['code' => 'HTTP50', 'note' => 'Test HTTP', 'kind' => 'fixed', 'value' => 50, 'minOrder' => 1000, 'usageLimit' => 2, 'active' => true]);
        Bundle::create(['slug' => 'pack-http', 'title' => 'Lot HTTP', 'description' => 'Composition de test', 'items' => [['id' => 'CF-EI60-90', 'qty' => 2]], 'price' => 3900, 'active' => true]);
        LandingPage::create(['slug' => 'page-http', 'title' => 'Page HTTP', 'blocks' => [['type' => 'hero', 'title' => 'Bannière HTTP', 'ctaUrl' => '/produits', 'ctaLabel' => 'Voir'], ['type' => 'products', 'title' => 'Sélection HTTP', 'ids' => ['CF-EI60-90']], ['type' => 'faq', 'title' => 'Question HTTP', 'items' => [['q' => 'Test de contenu ?', 'a' => 'Réponse de test.']]]], 'published' => true]);
        Redirect::create(['from' => '/ancien-http', 'to' => '/l/page-http', 'code' => 301, 'active' => true]);

        Popup::create(['name' => 'Test HTTP', 'title' => 'Fenêtre HTTP', 'body' => 'Message de test.', 'kind' => 'promo', 'trigger' => 'delay', 'frequency' => 'session', 'active' => true]);

        ContentPage::create(['kind' => 'page', 'slug' => 'contenu-http', 'title' => 'Contenu HTTP', 'bodyHtml' => '<p>Texte CMS HTTP</p>', 'published' => true]);
        ContentPage::create(['kind' => 'technology', 'slug' => 'technique-http', 'title' => 'Technique HTTP', 'blocks' => [['type' => 'text', 'body' => 'Section technique HTTP.']], 'published' => true]);
        ContentPage::create(['kind' => 'home', 'slug' => 'accueil', 'title' => 'Accueil HTTP', 'excerpt' => 'Bannière modifiée depuis le CMS de test.', 'featuredProductId' => 'CF-EI60-90', 'published' => true, 'blocks' => [['type' => 'text', 'title' => 'Section accueil HTTP', 'body' => 'Section de test.']]]);

        return 0;
    }

    /** Never seed a real database: PostgreSQL database named *_test, or a SQLite file under /tmp. */
    private static function isolatedTestDatabase(): bool
    {
        $connection = config('database.default');
        $database = (string) config("database.connections.{$connection}.database");

        return match (config("database.connections.{$connection}.driver")) {
            'pgsql' => (bool) preg_match('/_test$/', $database),
            'sqlite' => str_starts_with($database, '/tmp/'),
            default => false,
        };
    }
}
