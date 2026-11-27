<?php

namespace Tests\Feature;

use App\Filament\Pages\Dashboard;
use App\Filament\Widgets\CitySales;
use App\Filament\Widgets\DailySales;
use App\Filament\Widgets\OrdersByStatus;
use App\Filament\Widgets\PendingActions;
use App\Filament\Widgets\ProductSales;
use App\Filament\Widgets\RecentActivity;
use App\Filament\Widgets\ShopStats;
use App\Filament\Widgets\TrafficSources;
use App\Models\Bundle;
use App\Models\Category;
use App\Models\ContentPage;
use App\Models\Product;
use App\Models\User;
use App\Services\AnalyticsQueries;
use Carbon\CarbonImmutable;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Livewire\Livewire;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    private CarbonImmutable $now;

    protected function setUp(): void
    {
        parent::setUp();
        $this->now = CarbonImmutable::parse('2026-11-27 12:00:00', 'UTC');
        CarbonImmutable::setTestNow($this->now);
        \Illuminate\Support\Carbon::setTestNow($this->now);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        \Illuminate\Support\Carbon::setTestNow();
        parent::tearDown();
    }

    private function ms(CarbonImmutable $at): int
    {
        return $at->getTimestampMs();
    }

    private function order(string $number, string $status, int $total, CarbonImmutable $at, string $city = 'Casablanca'): int
    {
        return DB::table('Order')->insertGetId([
            'number' => $number, 'createdAt' => $this->ms($at), 'status' => $status, 'customerName' => 'Client '.$number, 'phone' => '0600000000',
            'city' => $city, 'address' => 'Adresse', 'deliveryMode' => 'livraison', 'deliveryFee' => 0, 'paymentMethod' => 'virement',
            'subtotal' => $total, 'total' => $total,
        ]);
    }

    private function quote(string $status, CarbonImmutable $at, ?int $orderId = null): int
    {
        return DB::table('Quote')->insertGetId([
            'status' => $status, 'createdAt' => $this->ms($at), 'orderId' => $orderId, 'clientName' => 'Client devis', 'city' => 'Rabat',
            'totalHt' => 1000, 'totalTtc' => 1200, 'transport' => '0', 'lines' => '[]', 'token' => bin2hex(random_bytes(16)),
        ]);
    }

    private function customerOrder(int $quoteId, string $status, int $total, CarbonImmutable $at): int
    {
        return DB::table('customer_orders')->insertGetId([
            'reference' => 'CMD-'.$quoteId, 'quote_id' => $quoteId, 'quote_version_id' => 1, 'quote_decision_id' => $quoteId, 'version_number' => 'V1',
            'client_name' => 'Client commande', 'city' => 'Marrakech', 'lines' => json_encode([['reference' => 'P-1', 'name' => 'Porte', 'qty' => 1, 'total_ttc' => $total]]),
            'totals' => '{}', 'total_ttc' => $total, 'tax_rate' => 20, 'delivery' => '{}', 'fulfilment' => 'livraison', 'status' => $status,
            'created_at' => $at, 'updated_at' => $at,
        ]);
    }

    /** Small, hand-checked fixture: see the expected figures in test_kpis_return_the_right_numbers_on_a_small_fixture. */
    private function seedFixture(): void
    {
        $d = fn (int $days) => $this->now->subDays($days);

        // Current 30-day window.
        $this->order('A', 'confirmé', 1000, $d(2));                  // shop order, sold
        $this->order('B', 'nouveau', 500, $d(3), 'Rabat');           // shop order, not sold yet
        $c = $this->order('C', 'nouveau', 3000, $d(5));              // a quote request, not an order
        $this->quote('à valider', $d(5), $c);                        // waiting for the team
        $q2 = $this->quote('validé', $d(4));                          // accepted, became a paid customer order
        DB::table('Quote')->where('id', $q2)->update(['customerDecision' => 'accepté']);
        $this->customerOrder($q2, 'paiement_confirme', 2000, $d(1));

        // Previous 30-day window.
        $this->order('D', 'livré', 600, $d(40));

        // Customers.
        foreach ([[1, '0611111111'], [6, '0622222222'], [45, '0633333333']] as [$days, $phone]) {
            DB::table('Contact')->insert(['phone' => $phone, 'name' => 'Contact '.$phone, 'createdAt' => $this->ms($d($days)), 'lastActivityAt' => $this->ms($d($days))]);
        }

        // Carts: one abandoned, one recovered, one empty.
        foreach ([['c1', 2, 800, 'ouvert'], ['c2', 1, 300, 'récupéré'], ['c3', 0, 0, 'ouvert']] as [$id, $count, $subtotal, $status]) {
            DB::table('Cart')->insert(['id' => $id, 'items' => '[]', 'itemCount' => $count, 'subtotal' => $subtotal, 'status' => $status, 'createdAt' => $this->ms($d(2)), 'updatedAt' => $this->ms($d(2))]);
        }

        DB::table('Event')->insert([
            ['at' => $this->ms($d(1)), 'type' => 'view', 'source' => 'google'],
            ['at' => $this->ms($d(1)), 'type' => 'view', 'source' => null],
            ['at' => $this->ms($d(1)), 'type' => 'order', 'source' => 'google'],
        ]);
    }

    public function test_kpis_return_the_right_numbers_on_a_small_fixture(): void
    {
        $this->seedFixture();
        $r = AnalyticsQueries::range('30j');

        $now = AnalyticsQueries::kpis($r['from'], $r['to']);
        $this->assertSame(3000, $now['revenue']);          // A (1000) + paid customer order (2000)
        $this->assertSame(3, $now['orders']);              // A, B and the customer order (C is a quote request)
        $this->assertSame(2, $now['sold']);
        $this->assertSame(1500, $now['averageBasket']);
        $this->assertSame(2, $now['quotes']);
        $this->assertSame(1, $now['convertedQuotes']);
        $this->assertSame(50.0, $now['conversionRate']);
        $this->assertSame(2, $now['newCustomers']);
        $this->assertSame(1, $now['abandonedCarts']);
        $this->assertSame(800, $now['abandonedValue']);

        $before = AnalyticsQueries::kpis($r['prevFrom'], $r['prevTo']);
        $this->assertSame(600, $before['revenue']);
        $this->assertSame(1, $before['orders']);
        $this->assertSame(1, $before['newCustomers']);
        $this->assertSame(0, $before['quotes']);

        $this->assertSame(['toValidate' => 1, 'awaitingClient' => 0], AnalyticsQueries::quoteBacklog());

        $week = AnalyticsQueries::range('7j');
        $this->assertSame(3000, AnalyticsQueries::kpis($week['from'], $week['to'])['revenue']);
        $this->assertSame(0, AnalyticsQueries::kpis($week['prevFrom'], $week['prevTo'])['revenue']);

        $stages = AnalyticsQueries::ordersByStatus($r['from'], $r['to']);
        $this->assertSame(['À traiter' => 1, 'Confirmée / payée' => 2], $stages);

        $series = AnalyticsQueries::salesSeries($r['from'], $r['to']);
        $this->assertSame(3000, array_sum($series['revenue']));
        $this->assertSame(3, array_sum($series['requests']));
        $this->assertCount(31, $series['labels']);
        $this->assertCount(13, AnalyticsQueries::salesSeries(...array_values(array_slice(AnalyticsQueries::range('12m'), 0, 2)))['labels']);

        $cities = AnalyticsQueries::topCities($r['from'], $r['to']);
        $this->assertSame('Marrakech', $cities[0]['city']);
        $this->assertSame(2000, $cities[0]['sales']);
        $this->assertSame(['source' => 'google', 'views' => 1, 'quotes' => 0, 'orders' => 1], collect(AnalyticsQueries::trafficSources($r['from'], $r['to']))->firstWhere('source', 'google'));
    }

    public function test_dashboard_renders_for_admin_with_data(): void
    {
        $this->seedFixture();
        $this->actingAs(User::factory()->create(['role' => 'admin']));

        $this->get('/admin')->assertOk()->assertSee('Tableau de bord')->assertSee('Période');
        Livewire::test(ShopStats::class, ['pageFilters' => ['period' => '30j']])
            ->assertStatus(200)
            ->assertSee('Chiffre d’affaires', false)
            ->assertSee('3 000 MAD')
            ->assertSee('Panier moyen')
            ->assertSee('Conversion devis → commande', false)
            ->assertSee('50,0 %')
            ->assertSee('Paniers abandonnés')
            ->assertSee('Nouveaux clients')
            ->assertSee('↑', false);
        Livewire::test(PendingActions::class)->assertStatus(200)->assertSee('Devis à valider')->assertSee('Commande à confirmer')->assertSee('Client B');
        foreach ([DailySales::class, OrdersByStatus::class, ProductSales::class, CitySales::class, TrafficSources::class, RecentActivity::class] as $widget) {
            foreach (array_keys(AnalyticsQueries::PERIODS) as $period) {
                Livewire::test($widget, ['pageFilters' => ['period' => $period]])->assertStatus(200);
            }
        }
        $this->get('/admin/analytics?filters[period]=90j')->assertOk()->assertSee('90 jours');
    }

    public function test_dashboard_renders_with_an_empty_database(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'admin']));

        $this->get('/admin')->assertOk()->assertSee('Tableau de bord');
        Livewire::test(Dashboard::class)->assertStatus(200);
        Livewire::test(ShopStats::class)->assertStatus(200)->assertSee('0 MAD')->assertSee('Aucun sur les deux périodes');
        Livewire::test(PendingActions::class)->assertStatus(200)->assertSee('Rien à traiter');
        foreach ([DailySales::class, OrdersByStatus::class, ProductSales::class, CitySales::class, TrafficSources::class, RecentActivity::class] as $widget) {
            Livewire::test($widget)->assertStatus(200);
        }
    }

    public function test_viewer_without_analytics_permission_sees_no_figures(): void
    {
        $this->seedFixture();
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        $response = $this->get('/admin');
        if ($response->isOk()) {
            $this->assertSame(auth()->user()->canDo('view.analytics'), ShopStats::canView());
        } else {
            $response->assertForbidden();
        }
    }

    public function test_panel_branding_and_spa_mode_keep_livewire_uploads(): void
    {
        $panel = Filament::getPanel('admin');
        $this->assertSame('FAW Aluminium', $panel->getBrandName());
        $this->assertSame(Dashboard::class, collect($panel->getPages())->first(fn ($p) => is_a($p, \Filament\Pages\Dashboard::class, true)));
        $this->assertTrue($panel->isSidebarCollapsibleOnDesktop());
        $this->assertTrue($panel->hasSpaMode());
        // Livewire uploads go through their own signed endpoint, not wire:navigate: it must stay registered.
        $this->assertTrue(Route::has('livewire.upload-file'));
        // Downloads are excluded from SPA navigation (they are not Livewire pages).
        Filament::setCurrentPanel($panel);
        $panel->boot();
        $this->assertFalse(\Filament\Support\Facades\FilamentView::hasSpaMode(url('/admin/quotes/1/pdf')));
        $this->assertTrue(\Filament\Support\Facades\FilamentView::hasSpaMode(url('/admin/quotes')));
    }

    public function test_blog_posts_put_posts_without_publication_date_last(): void
    {
        ContentPage::create(['kind' => 'blog', 'slug' => 'sans-date', 'title' => 'Sans date', 'published' => true, 'publishedAt' => null]);
        ContentPage::create(['kind' => 'blog', 'slug' => 'ancien', 'title' => 'Ancien', 'published' => true, 'publishedAt' => now()->subDays(10)]);
        ContentPage::create(['kind' => 'blog', 'slug' => 'recent', 'title' => 'Récent', 'published' => true, 'publishedAt' => now()->subDay()]);

        $slugs = collect($this->getJson('/api/blog')->assertOk()->json('data'))->pluck('slug')->all();
        $this->assertSame(['recent', 'ancien', 'sans-date'], $slugs);
    }

    public function test_shop_merch_hides_inactive_categories_and_packs_with_unpublished_products(): void
    {
        $root = Category::create(['slug' => 'portes', 'label' => 'Portes', 'family' => 'incendie', 'active' => true, 'updatedAt' => now()]);
        Category::create(['slug' => 'brouillon', 'label' => 'Brouillon', 'family' => 'incendie', 'active' => false, 'updatedAt' => now()]);
        $hidden = Category::create(['slug' => 'parent-cache', 'label' => 'Parent caché', 'family' => 'incendie', 'active' => false, 'updatedAt' => now()]);
        Category::create(['slug' => 'enfant-actif', 'label' => 'Enfant', 'family' => 'incendie', 'active' => true, 'parentId' => $hidden->id, 'updatedAt' => now()]);
        Category::create(['slug' => 'sous-portes', 'label' => 'Sous-portes', 'family' => 'incendie', 'active' => true, 'parentId' => $root->id, 'updatedAt' => now()]);

        Product::create(['id' => 'P-ON', 'slug' => 'p-on', 'title' => 'Visible', 'description' => 'Test', 'price' => 100, 'category' => 'Portes', 'active' => true, 'updatedAt' => now()]);
        Product::create(['id' => 'P-OFF', 'slug' => 'p-off', 'title' => 'Masqué', 'description' => 'Test', 'price' => 100, 'category' => 'Portes', 'active' => false, 'updatedAt' => now()]);
        Bundle::create(['slug' => 'pack-ok', 'title' => 'Pack OK', 'items' => [['id' => 'P-ON', 'qty' => 1]], 'price' => 90, 'active' => true]);
        Bundle::create(['slug' => 'pack-masque', 'title' => 'Pack masqué', 'items' => [['id' => 'P-ON', 'qty' => 1], ['id' => 'P-OFF', 'qty' => 1]], 'price' => 150, 'active' => true]);
        Bundle::create(['slug' => 'pack-inactif', 'title' => 'Pack inactif', 'items' => [['id' => 'P-ON', 'qty' => 1]], 'price' => 90, 'active' => false]);

        $json = $this->getJson('/api/shop/merch')->assertOk()->json();
        $this->assertEqualsCanonicalizing(['portes', 'sous-portes'], array_column($json['categories'], 'slug'));
        $this->assertSame(['pack-ok'], array_column($json['bundles'], 'slug'));
    }
}
