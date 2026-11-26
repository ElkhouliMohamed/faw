<?php

namespace Tests\Feature;

use App\Filament\Pages\Analytics as AnalyticsPage;
use App\Filament\Resources\AuditLogs\AuditLogResource;
use App\Filament\Resources\Cmi\CmiResource;
use App\Filament\Resources\Customers\CustomerResource;
use App\Filament\Resources\Integrations\IntegrationsResource;
use App\Filament\Resources\Products\ProductResource;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Filament\Resources\ShopOrders\ShopOrderResource;
use App\Filament\Resources\Users\UserResource;
use App\Models\AuditEntry;
use App\Models\Product;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class RoleAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'updatedAt' => now()]);
    }

    private function user(string $role, array $extra = []): User
    {
        return User::factory()->create(array_merge(['role' => $role], $extra));
    }

    public function test_each_role_is_allowed_or_denied_the_expected_areas(): void
    {
        $product = Product::first();
        $this->assertNotNull($product);

        $matrix = [
            'super_admin' => [
                'view' => [UserResource::class, AuditLogResource::class, QuoteResource::class, ProductResource::class, IntegrationsResource::class, CmiResource::class, CustomerResource::class],
                'create' => [UserResource::class, ProductResource::class],
                'validate' => true,
            ],
            'technical_admin' => [
                'view' => [IntegrationsResource::class, CmiResource::class],
                'deny_view' => [UserResource::class, AuditLogResource::class, QuoteResource::class, CustomerResource::class],
                'create' => [],
                'deny_create' => [UserResource::class, ProductResource::class],
                'validate' => false,
            ],
            'sales_manager' => [
                'view' => [QuoteResource::class, CustomerResource::class, ShopOrderResource::class],
                'deny_view' => [UserResource::class, IntegrationsResource::class, AuditLogResource::class, ProductResource::class],
                'create' => [CustomerResource::class],
                'validate' => true,
            ],
            'sales_rep' => [
                'view' => [QuoteResource::class, CustomerResource::class, ShopOrderResource::class],
                'deny_view' => [UserResource::class, IntegrationsResource::class, ProductResource::class],
                'create' => [CustomerResource::class],
                'validate' => false,
            ],
            'catalogue_manager' => [
                'view' => [ProductResource::class],
                'deny_view' => [CustomerResource::class, QuoteResource::class, UserResource::class, IntegrationsResource::class],
                'create' => [ProductResource::class],
                'validate' => false,
            ],
            'seo_content_manager' => [
                'view' => [],
                'deny_view' => [CustomerResource::class, QuoteResource::class, ShopOrderResource::class, UserResource::class, IntegrationsResource::class],
                'deny_create' => [ProductResource::class, CustomerResource::class],
                'validate' => false,
            ],
            'stock_manager' => [
                'view' => [ProductResource::class, ShopOrderResource::class],
                'deny_view' => [QuoteResource::class, UserResource::class, IntegrationsResource::class],
                'deny_create' => [ProductResource::class],
                'edit_product' => true,
                'validate' => false,
            ],
            'finance_manager' => [
                'view' => [ShopOrderResource::class, CmiResource::class],
                'deny_view' => [UserResource::class, IntegrationsResource::class, ProductResource::class, QuoteResource::class],
                'deny_create' => [ProductResource::class],
                'validate' => false,
            ],
            'viewer' => [
                'view' => [QuoteResource::class, CustomerResource::class, ProductResource::class, ShopOrderResource::class],
                'deny_view' => [UserResource::class, IntegrationsResource::class, AuditLogResource::class, CmiResource::class],
                'deny_create' => [QuoteResource::class, ProductResource::class, CustomerResource::class, ShopOrderResource::class],
                'validate' => false,
            ],
        ];

        foreach ($matrix as $role => $expect) {
            $this->actingAs($this->user($role));
            foreach ($expect['view'] ?? [] as $resource) {
                $this->assertTrue($resource::canViewAny(), "$role should view $resource");
            }
            foreach ($expect['deny_view'] ?? [] as $resource) {
                $this->assertFalse($resource::canViewAny(), "$role should not view $resource");
            }
            foreach ($expect['create'] ?? [] as $resource) {
                $this->assertTrue($resource::canCreate(), "$role should create $resource");
            }
            foreach ($expect['deny_create'] ?? [] as $resource) {
                $this->assertFalse($resource::canCreate(), "$role should not create $resource");
            }
            if (array_key_exists('edit_product', $expect)) {
                $this->assertSame($expect['edit_product'], ProductResource::canEdit($product), "$role product edit");
                $this->assertFalse(ProductResource::canDelete($product), "$role must not delete products");
            }
            $this->assertSame($expect['validate'], auth()->user()->canDo('validate.quotes'), "$role validate.quotes");
        }
    }

    public function test_viewer_is_strictly_read_only(): void
    {
        $this->actingAs($this->user('viewer'));
        $product = Product::first();
        $this->assertFalse(ProductResource::canCreate());
        $this->assertFalse(ProductResource::canEdit($product));
        $this->assertFalse(ProductResource::canDelete($product));
        $this->assertFalse(QuoteResource::canCreate());
        $this->assertFalse(auth()->user()->canDo('validate.quotes'));
        $this->get('/admin/users')->assertForbidden();
        $this->get('/admin/quotes')->assertOk();
        $this->get('/admin/products')->assertOk();
        $this->get('/admin/audit-log')->assertForbidden();
        $this->get('/admin/notifications')->assertForbidden();
    }

    public function test_last_super_admin_cannot_be_demoted_or_disabled(): void
    {
        $only = $this->user('super_admin');
        $this->expectException(ValidationException::class);
        $only->update(['role' => 'viewer']);
    }

    public function test_last_super_admin_cannot_be_disabled(): void
    {
        $only = $this->user('super_admin');
        try {
            $only->update(['is_active' => false]);
            $this->fail('Le dernier super administrateur a pu être désactivé.');
        } catch (ValidationException $e) {
            $this->assertTrue($only->fresh()->is_active);
            $this->assertSame('super_admin', $only->fresh()->role);
        }
    }

    public function test_another_super_admin_can_be_demoted_when_one_remains(): void
    {
        $keep = $this->user('super_admin');
        $other = $this->user('super_admin');
        $other->update(['role' => 'viewer']);
        $this->assertSame('viewer', $other->fresh()->role);
        $this->assertSame('super_admin', $keep->fresh()->role);
    }

    public function test_disabled_user_cannot_access_the_panel(): void
    {
        $user = $this->user('viewer', ['is_active' => false]);
        $panel = Filament::getPanel('admin');
        $this->assertFalse($user->canAccessPanel($panel));
        $this->actingAs($user);
        $this->get('/admin')->assertForbidden();
        $this->get('/admin/products')->assertForbidden();
    }

    public function test_active_users_can_open_the_panel(): void
    {
        $this->actingAs($this->user('viewer'));
        $this->get('/admin')->assertOk();
        $this->actingAs($this->user('super_admin'));
        $this->get('/admin/users')->assertOk();
        $this->get('/admin/audit-log')->assertOk();
    }

    public function test_audit_entry_is_created_without_secrets(): void
    {
        $admin = $this->user('super_admin');
        $this->actingAs($admin);
        $product = Product::first();
        $product->update(['title' => 'Titre audit rôle']);
        $entry = AuditEntry::query()->where('entity', 'Product')->where('action', 'updated')->orderByDesc('id')->first();
        $this->assertNotNull($entry);
        $this->assertSame($admin->email, $entry->actor);
        $this->assertNotEmpty($entry->at);
        $this->assertStringContainsString('Titre audit rôle', (string) $entry->changes);

        $target = $this->user('viewer');
        $target->update(['password' => 'NouveauMotDePasse12']);
        $userEntry = AuditEntry::query()->where('entity', 'users')->where('entityId', (string) $target->id)->orderByDesc('id')->first();
        $this->assertNotNull($userEntry);
        $this->assertStringContainsString('[masqué]', (string) $userEntry->changes);
        $this->assertStringNotContainsString('NouveauMotDePasse12', (string) $userEntry->changes);
        $this->assertDoesNotMatchRegularExpression('/\$2[aby]\$/', (string) $userEntry->changes);
    }

    public function test_legacy_admin_role_still_acts_as_super_admin(): void
    {
        $this->actingAs($this->user('admin'));
        $this->assertTrue(UserResource::canViewAny());
        $this->assertTrue(auth()->user()->isSuperAdmin());
        $this->assertTrue(auth()->user()->canDo('validate.quotes'));
    }

    public function test_sales_rep_cannot_open_system_settings(): void
    {
        $this->actingAs($this->user('sales_rep'));
        $this->get('/admin/quotes')->assertOk();
        $this->get('/admin/integrations')->assertForbidden();
        $this->get('/admin/users')->assertForbidden();
        $this->assertTrue(AnalyticsPage::canAccess());
    }
}
