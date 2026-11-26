<?php

namespace Tests\Feature;

use App\Filament\Resources\CustomerOrders\OrderResource;
use App\Filament\Resources\CustomerOrders\Pages\ManageCustomerOrders;
use App\Models\CustomerOrder;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\Quote;
use App\Models\QuoteDecision;
use App\Models\QuoteOtp;
use App\Models\QuoteVersion;
use App\Models\User;
use App\Services\OrderService;
use App\Support\OrderStatus;
use Filament\Actions\Testing\TestAction;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\Concerns\AcceptsQuotes;
use Tests\Concerns\QuoteSandbox;
use Tests\TestCase;

class CustomerOrderTest extends TestCase
{
    use AcceptsQuotes, QuoteSandbox, RefreshDatabase;

    private function acceptedOrder(int $qty = 2, bool $pickup = false): CustomerOrder
    {
        $this->fakeResend();
        $q = $this->validatedQuote($qty, $pickup);
        $this->acceptCurrent($q, $this->rawToken)->assertOk();

        return CustomerOrder::where('quote_id', $q->id)->sole();
    }

    public function test_acceptance_creates_one_order_copying_the_accepted_version(): void
    {
        $o = $this->acceptedOrder(2, false);
        $year = now('Africa/Casablanca')->format('Y');
        $this->assertSame("FAW-CMD-{$year}-0001", $o->reference);
        $v = QuoteVersion::findOrFail($o->quote_version_id);
        $this->assertSame($v->lines, $o->lines);
        $this->assertSame($v->totals, $o->totals);
        $this->assertSame(4400, $o->total_ttc);
        $this->assertSame(20, $o->tax_rate);
        $this->assertSame('MAD', $o->currency);
        $this->assertSame('option', $o->delivery['mode']);
        $this->assertFalse($o->delivery['in_total']);
        $this->assertSame('livraison', $o->fulfilment);
        $this->assertSame(OrderStatus::AwaitingPayment, $o->status);
        $this->assertSame([null, 'en_attente_paiement'], [$o->history()->first()->from_status, $o->history()->first()->to_status]);
        $this->assertSame(QuoteDecision::where('decision', 'accepted')->sole()->id, (int) $o->quote_decision_id);

        // Idempotent: replays never create a second order; the next quote gets the next number.
        $vid = $o->quote_version_id;
        $this->postJson('/api/portal/'.$this->rawToken.'/otp', ['versionId' => $vid])->assertStatus(422)->assertJsonPath('code', 'already_accepted');
        $this->postJson('/api/portal/'.$this->rawToken.'/accept', ['versionId' => $vid, 'code' => $this->lastOtp(), 'confirm' => true])->assertStatus(422)->assertJsonPath('code', 'already_accepted');
        $this->assertSame(1, CustomerOrder::count());
        $q2 = $this->validatedQuote(1, true);
        $this->acceptCurrent($q2, $this->rawToken)->assertOk();
        $o2 = CustomerOrder::where('quote_id', $q2->id)->sole();
        $this->assertSame("FAW-CMD-{$year}-0002", $o2->reference);
        $this->assertSame('retrait', $o2->fulfilment);
        $this->assertSame('9002', $this->counterValue()); // quote numbers only from the sandbox counter, orders have their own sequence
    }

    public function test_acceptance_and_order_are_one_transaction(): void
    {
        $this->fakeResend();
        $q = $this->validatedQuote();
        $this->app->bind(OrderService::class, fn () => new class extends OrderService
        {
            public function createFromAcceptance(Quote $q, QuoteVersion $v, QuoteDecision $d): CustomerOrder
            {
                throw new \RuntimeException('order failure');
            }
        });
        $this->withoutExceptionHandling();
        try {
            $this->acceptCurrent($q, $this->rawToken);
            $this->fail('no exception');
        } catch (\RuntimeException $e) {
            $this->assertSame('order failure', $e->getMessage());
        }
        $this->assertSame(0, QuoteDecision::count());
        $this->assertSame(0, CustomerOrder::count());
        $this->assertNull($q->fresh()->customerDecision);
        $this->assertNull(QuoteOtp::sole()->consumed_at);
    }

    public function test_order_content_is_frozen_and_ignores_later_price_changes(): void
    {
        $o = $this->acceptedOrder();
        Product::first()->update(['price' => 9999]);
        $this->assertSame(2200, $o->fresh()->lines[0]['unit_ttc']);
        $this->expectException(\LogicException::class);
        $o->update(['total_ttc' => 1]);
    }

    public function test_status_changes_follow_roles_and_are_historised(): void
    {
        $o = $this->acceptedOrder();
        $svc = app(OrderService::class);
        $user = fn (string $role) => User::factory()->create(['role' => $role]);

        $stock = $user('stock_manager');
        $svc->transition($o, OrderStatus::Preparing, $stock, 'Préparation');
        try {
            $svc->transition($o, OrderStatus::PaymentConfirmed, $stock);
            $this->fail('logistics confirmed a payment');
        } catch (ValidationException) {
        }
        $finance = $user('finance_manager');
        $svc->transition($o, OrderStatus::PartiallyPaid, $finance);
        try {
            $svc->transition($o, OrderStatus::Cancelled, $finance);
            $this->fail('finance cancelled');
        } catch (ValidationException) {
        }
        foreach (['viewer', 'sales_rep', 'technical_admin'] as $role) {
            $this->assertSame([], OrderStatus::allowedFor($user($role)), $role);
        }
        $sales = $user('sales_manager');
        $svc->transition($o, OrderStatus::Cancelled, $sales, 'Client injoignable');
        try {
            $svc->transition($o, OrderStatus::Processing, $sales);
            $this->fail('final status reopened');
        } catch (ValidationException) {
        }
        $svc->transition($o, OrderStatus::Processing, $user('super_admin'), 'Réouverture');
        $h = OrderStatusHistory::where('customer_order_id', $o->id)->orderBy('id')->get();
        $this->assertSame(['en_attente_paiement', 'en_preparation', 'partiellement_paye', 'annule', 'en_traitement'], $h->pluck('to_status')->all());
        $this->assertSame($stock->id, (int) $h[1]->user_id);
        $this->assertSame('Client injoignable', $h[3]->note);
        $this->expectException(\LogicException::class);
        $h[0]->delete();
    }

    public function test_filament_order_resource_permissions(): void
    {
        $o = $this->acceptedOrder();
        foreach (['super_admin' => [200, true, true], 'sales_manager' => [200, true, true], 'stock_manager' => [200, true, true], 'finance_manager' => [200, true, false], 'sales_rep' => [200, false, false], 'viewer' => [200, false, false], 'technical_admin' => [403, false, false], 'catalogue_manager' => [403, false, false]] as $role => [$http, $status, $delivery]) {
            $this->actingAs(User::factory()->create(['role' => $role]));
            $this->get('/admin/customer-orders')->assertStatus($http);
            if ($http === 200) {
                $lw = Livewire::test(ManageCustomerOrders::class)->assertSee($o->reference);
                $status ? $lw->assertActionVisible(TestAction::make('changerStatut')->table($o)) : $lw->assertActionHidden(TestAction::make('changerStatut')->table($o));
                $delivery ? $lw->assertActionVisible(TestAction::make('livraison')->table($o)) : $lw->assertActionHidden(TestAction::make('livraison')->table($o));
                $this->assertFalse(OrderResource::canEdit($o) || OrderResource::canDelete($o) || OrderResource::canCreate());
            }
            auth()->logout();
        }
        $this->actingAs(User::factory()->create(['role' => 'stock_manager']));
        Livewire::test(ManageCustomerOrders::class)->callAction(TestAction::make('changerStatut')->table($o), data: ['status' => 'pret_retrait', 'note' => 'Prête'])->assertHasNoActionErrors();
        $this->assertSame(OrderStatus::ReadyForPickup, $o->fresh()->status);
        Livewire::test(ManageCustomerOrders::class)->callAction(TestAction::make('livraison')->table($o), data: ['fulfilment' => 'livraison', 'delivery_address' => 'Zone industrielle, Casablanca', 'delivery_note' => 'Appeler avant'])->assertHasNoActionErrors();
        $this->assertSame('Zone industrielle, Casablanca', $o->fresh()->delivery_address);
        Livewire::test(ManageCustomerOrders::class)->mountAction(TestAction::make('view')->table($o))->assertMountedActionModalSee([$o->reference, 'Historique']);
    }

    public function test_portal_tracks_the_order_and_never_invents_a_pickup_address(): void
    {
        $o = $this->acceptedOrder(1, true);
        $this->getJson('/api/portal/'.$this->rawToken)->assertOk()
            ->assertJsonPath('order.reference', $o->reference)->assertJsonPath('order.status', 'en_attente_paiement')
            ->assertJsonPath('order.fulfilment', 'retrait')->assertJsonPath('order.pickupAddress', null)
            ->assertJsonPath('order.history.0.status', 'en_attente_paiement');
        config(['faw.pickup_address' => 'Dépôt FAW (adresse de test)']);
        $this->getJson('/api/portal/'.$this->rawToken)->assertJsonPath('order.pickupAddress', 'Dépôt FAW (adresse de test)');
        app(OrderService::class)->transition($o, OrderStatus::ReadyForPickup, User::factory()->create(['role' => 'stock_manager']));
        $this->getJson('/api/portal/'.$this->rawToken)->assertJsonPath('order.status', 'pret_retrait')->assertJsonPath('order.history.1.status', 'pret_retrait');
    }
}
