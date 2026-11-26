<?php

namespace Tests\Feature;

use App\Filament\Resources\Quotes\Pages\ManageQuotes;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Models\Quote;
use App\Models\User;
use App\Support\Role;
use Filament\Actions\Testing\TestAction;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\TestCase;

/** Server-side authorization for the 9 back-office roles, checked over HTTP (not only through UI visibility). */
class RoleHttpAuthorizationTest extends TestCase
{
    use RefreshDatabase;

    private const PATHS = ['users', 'audit-log', 'quotes', 'customers', 'shop-orders', 'customer-orders', 'carts', 'products', 'categories', 'medias', 'blogposts', 'coupons', 'shippingcitys', 'settings', 'cmi', 'integrations', 'contacts'];

    /** Hand-written expectations: a change in Role or ResourceAccess must be deliberate and update this table. */
    private const ALLOWED = [
        'super_admin' => self::PATHS,
        'technical_admin' => ['settings', 'cmi', 'integrations'],
        'sales_manager' => ['quotes', 'customers', 'shop-orders', 'customer-orders', 'carts', 'coupons', 'shippingcitys', 'contacts'],
        'sales_rep' => ['quotes', 'customers', 'shop-orders', 'customer-orders', 'carts', 'shippingcitys', 'contacts'],
        'catalogue_manager' => ['products', 'categories', 'medias', 'blogposts', 'coupons'],
        'seo_content_manager' => ['medias', 'blogposts'],
        'stock_manager' => ['products', 'categories', 'shop-orders', 'customer-orders', 'shippingcitys', 'customers'],
        'finance_manager' => ['shop-orders', 'customer-orders', 'cmi', 'settings'],
        'viewer' => ['quotes', 'customers', 'shop-orders', 'customer-orders', 'carts', 'products', 'categories', 'medias', 'blogposts', 'coupons', 'shippingcitys', 'settings', 'contacts'],
    ];

    private function quote(): Quote
    {
        return Quote::create(['clientName' => 'Client synthétique', 'city' => 'Casablanca', 'totalHt' => 1000, 'totalTtc' => 1200, 'transport' => 'Retrait', 'lines' => '[]', 'email' => 'delivered@resend.dev', 'token' => Quote::newRawToken()]);
    }

    public function test_matrix_covers_all_nine_roles(): void
    {
        $this->assertEqualsCanonicalizing(array_map(fn ($r) => $r->value, Role::cases()), array_keys(self::ALLOWED));
        $this->assertCount(9, Role::cases());
    }

    public function test_each_role_gets_exactly_its_admin_areas_over_http(): void
    {
        foreach (self::ALLOWED as $role => $allowed) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $this->get('/admin')->assertOk();
            foreach (self::PATHS as $path) {
                $status = $this->get('/admin/'.$path)->status();
                if (in_array($path, $allowed, true)) {
                    $this->assertSame(200, $status, "$role should open /admin/$path");
                } else {
                    $this->assertSame(403, $status, "$role must be refused /admin/$path");
                }
            }
            auth()->logout();
        }
    }

    public function test_inactive_accounts_of_every_role_are_refused(): void
    {
        foreach (array_keys(self::ALLOWED) as $role) {
            $this->actingAs(User::factory()->create(['role' => $role, 'is_active' => false]));
            $this->assertNotSame(200, $this->get('/admin')->status(), "inactive $role must not enter");
            $this->assertNotSame(200, $this->get('/admin/quotes')->status(), "inactive $role must not read quotes");
            auth()->logout();
        }
    }

    public function test_viewer_cannot_create_edit_or_delete_any_resource(): void
    {
        $this->actingAs(User::factory()->create(['role' => 'viewer']));
        $this->get('/admin');
        foreach (Filament::getPanel('admin')->getResources() as $resource) {
            $this->assertFalse($resource::canCreate(), "viewer create $resource");
            $model = $resource::getModel();
            $record = new $model;
            if ($resource !== QuoteResource::class) { // quotes open in a fully disabled form (checked below)
                $this->assertFalse($resource::canEdit($record), "viewer edit $resource");
            }
            $this->assertFalse($resource::canDelete($record), "viewer delete $resource");
        }
        $q = $this->quote();
        Livewire::test(ManageQuotes::class)->callAction(TestAction::make('edit')->table($q), data: ['clientName' => 'Modifié', 'totalTtc' => 1]);
        $this->assertSame('Client synthétique', $q->fresh()->clientName);
        $this->assertSame(1200, (int) $q->fresh()->totalTtc);
    }

    public function test_admin_quote_pdf_route_requires_view_quotes(): void
    {
        $q = $this->quote();
        $this->get('/admin/quotes/'.$q->id.'/pdf')->assertRedirect();
        foreach (self::ALLOWED as $role => $allowed) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $status = $this->get('/admin/quotes/'.$q->id.'/pdf')->status();
            // Pending quote has no PDF: authorized roles reach the 404, others are stopped with 403 first.
            $this->assertSame(in_array('quotes', $allowed, true) ? 404 : 403, $status, "$role admin pdf");
            auth()->logout();
        }
    }

    public function test_link_revoke_and_regenerate_actions_need_validate_quotes(): void
    {
        $q = $this->quote();
        foreach (['super_admin' => true, 'sales_manager' => true, 'sales_rep' => false, 'viewer' => false] as $role => $can) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $lw = Livewire::test(ManageQuotes::class);
            foreach (['revoquerLien', 'regenererLien'] as $action) {
                $can ? $lw->assertActionVisible(TestAction::make($action)->table($q)) : $lw->assertActionHidden(TestAction::make($action)->table($q));
            }
            auth()->logout();
        }

        $this->actingAs(User::factory()->create(['role' => 'sales_manager']));
        Livewire::test(ManageQuotes::class)->callAction(TestAction::make('revoquerLien')->table($q))->assertHasNoActionErrors();
        $this->assertNotNull($q->fresh()->tokenRevokedAt);
        Livewire::test(ManageQuotes::class)->callAction(TestAction::make('regenererLien')->table($q))->assertHasNoActionErrors()->assertNotified();
        $fresh = $q->fresh();
        $this->assertNull($fresh->tokenRevokedAt);
        $this->assertSame('actif', $fresh->linkState());
        $this->assertDatabaseHas('AuditLog', ['entity' => 'Quote']);
    }
}
