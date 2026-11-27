<?php

namespace Tests\Feature;

use App\Filament\Pages\OrdersKanban;
use App\Filament\Pages\QuotesKanban;
use App\Models\Activity;
use App\Models\CustomerOrder;
use App\Models\OrderStatusHistory;
use App\Models\Product;
use App\Models\ShopOrder;
use App\Models\User;
use App\Support\OrderStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Livewire\Livewire;
use Tests\Concerns\AcceptsQuotes;
use Tests\Concerns\QuoteSandbox;
use Tests\TestCase;

/** « Commandes — Tableau » and « Devis — Tableau »: moves go through the same services as the order / quote pages. */
class KanbanBoardTest extends TestCase
{
    use AcceptsQuotes, QuoteSandbox, RefreshDatabase;

    private function shopOrder(): ShopOrder
    {
        if (! Product::whereKey('CF-EI60-90')->exists()) {
            Product::create(['id' => 'CF-EI60-90', 'slug' => 'cf-ei60-90', 'title' => 'Porte coupe-feu EI60 90 cm', 'seoTitle' => 'Porte coupe-feu EI60', 'description' => '90 cm', 'price' => 2200, 'category' => 'Portes coupe-feu', 'availability' => 'en stock', 'active' => true, 'updatedAt' => now()]);
        }
        $this->postJson('/api/orders', ['name' => 'Client Tableau', 'company' => 'Atelier Test', 'phone' => '0612345678', 'email' => 'client@example.test', 'city' => 'Casablanca', 'address' => '1 rue de test, Maarif', 'items' => [['id' => 'CF-EI60-90', 'qty' => 1]], 'paymentMethod' => 'virement'])->assertCreated();

        return ShopOrder::latest('id')->firstOrFail();
    }

    private function customerOrder(): CustomerOrder
    {
        $this->fakeResend();
        $q = $this->validatedQuote(1, true);
        $this->acceptCurrent($q, $this->rawToken)->assertOk();

        return CustomerOrder::where('quote_id', $q->id)->sole();
    }

    private function as(string $role): User
    {
        $u = User::factory()->create(['role' => $role]);
        $this->actingAs($u);

        return $u;
    }

    public function test_boards_render_for_an_admin_with_cards_and_filters(): void
    {
        $o = $this->shopOrder();
        $this->as('super_admin');

        $this->get(OrdersKanban::getUrl())->assertOk()->assertSee(['Commandes — Tableau', 'Nouveau', 'Livré', $o->number, 'Client Tableau', 'Casablanca', 'MAD', 'Virement bancaire'], false);
        $this->get(OrdersKanban::getUrl(['source' => 'clients']))->assertOk()->assertSee(['En attente de paiement', 'Terminée']);
        $this->get(QuotesKanban::getUrl())->assertOk()->assertSee(['Devis — Tableau', 'À valider', 'Accepté par le client']);

        Livewire::test(OrdersKanban::class)->assertSee($o->number)
            ->set('search', 'introuvable-xyz')->assertDontSee($o->number)
            ->set('search', '')->set('city', 'Rabat')->assertDontSee($o->number)
            ->set('city', 'Casablanca')->set('payment', 'virement')->assertSee($o->number)
            ->set('from', now('Africa/Casablanca')->addDay()->format('Y-m-d'))->assertDontSee($o->number);
    }

    public function test_moving_a_shop_order_card_changes_the_status_and_writes_history(): void
    {
        $o = $this->shopOrder();
        $before = Activity::where('orderId', $o->id)->count();
        $this->as('sales_manager');

        Livewire::test(OrdersKanban::class)->call('moveCard', $o->id, 'en cours')->assertNotified('Commande '.$o->number.' : En cours');

        $this->assertSame('en cours', $o->fresh()->status);
        $this->assertSame($before + 1, Activity::where('orderId', $o->id)->count());
        $this->assertDatabaseHas('LeadEvent', ['orderId' => $o->id, 'fromStatus' => 'nouveau', 'toStatus' => 'en cours']);
        $this->assertDatabaseHas('AuditLog', ['entity' => 'Order', 'entityId' => (string) $o->id, 'action' => 'updated']);
    }

    public function test_moving_a_customer_order_card_goes_through_the_order_service(): void
    {
        $o = $this->customerOrder();
        $this->as('finance_manager');

        Livewire::test(OrdersKanban::class)->set('source', 'clients')
            ->call('moveCard', $o->id, OrderStatus::PaymentConfirmed->value)->assertNotified();

        $this->assertSame(OrderStatus::PaymentConfirmed, $o->fresh()->status);
        $h = OrderStatusHistory::where('customer_order_id', $o->id)->latest('id')->first();
        $this->assertSame([OrderStatus::AwaitingPayment->value, OrderStatus::PaymentConfirmed->value, 'admin'], [$h->from_status, $h->to_status, $h->source]);
    }

    public function test_invalid_transitions_are_rejected_without_history(): void
    {
        // Final status: only a super administrator may move a delivered order.
        $o = $this->shopOrder();
        $o->update(['status' => 'livré']);
        $before = Activity::where('orderId', $o->id)->count();
        $this->as('sales_manager');
        Livewire::test(OrdersKanban::class)->call('moveCard', $o->id, 'en cours')->assertNotified('Déplacement refusé');
        Livewire::test(OrdersKanban::class)->call('moveCard', $o->id, 'statut-inexistant')->assertNotified('Déplacement refusé');
        $this->assertSame('livré', $o->fresh()->status);
        $this->assertSame($before, Activity::where('orderId', $o->id)->count());

        // Role limit: logistics cannot set a payment step on a customer order.
        $co = $this->customerOrder();
        $count = OrderStatusHistory::where('customer_order_id', $co->id)->count();
        $this->as('stock_manager');
        Livewire::test(OrdersKanban::class)->set('source', 'clients')->call('moveCard', $co->id, OrderStatus::PaymentConfirmed->value)->assertNotified('Déplacement refusé');
        $this->assertSame(OrderStatus::AwaitingPayment, $co->fresh()->status);
        $this->assertSame($count, OrderStatusHistory::where('customer_order_id', $co->id)->count());

        // Quotes: customer decisions are never set from the board; validation only from « à valider ».
        $q = $this->submitQuote();
        $this->as('sales_manager');
        Livewire::test(QuotesKanban::class)->call('moveCard', $q->id, 'accepte')->assertNotified('Déplacement refusé');
        Livewire::test(QuotesKanban::class)->call('moveCard', $q->id, 'envoye')->assertNotified('Déplacement refusé');
        $this->assertSame('à valider', $q->fresh()->status);
    }

    public function test_quote_refusal_from_the_board_asks_for_the_reason(): void
    {
        $q = $this->submitQuote();
        $this->as('sales_manager');

        Livewire::test(QuotesKanban::class)->call('moveCard', $q->id, 'refuse')->assertActionMounted('refuser')
            ->setActionData(['reason' => 'Hors zone de livraison'])->callMountedAction()->assertHasNoActionErrors();

        $fresh = $q->fresh();
        $this->assertSame('refusé', $fresh->status);
        $this->assertSame('Hors zone de livraison', $fresh->cancelReason);
    }

    public function test_unauthorized_users_cannot_move_cards(): void
    {
        $o = $this->shopOrder();
        $q = $this->submitQuote();

        // Viewer: can read the boards, every move is refused.
        $this->as('viewer');
        $this->get(OrdersKanban::getUrl())->assertOk()->assertSee('Lecture seule');
        Livewire::test(OrdersKanban::class)->call('moveCard', $o->id, 'en cours')->assertNotified('Déplacement refusé');
        Livewire::test(QuotesKanban::class)->call('moveCard', $q->id, 'refuse')->assertNotified('Déplacement refusé')->assertActionNotMounted('refuser');
        $this->assertSame('nouveau', $o->fresh()->status);
        $this->assertSame('à valider', $q->fresh()->status);

        // Sales rep: may move orders, but not validate or refuse quotes.
        $this->as('sales_rep');
        Livewire::test(QuotesKanban::class)->call('moveCard', $q->id, 'valide')->assertNotified('Déplacement refusé');
        $this->assertSame('à valider', $q->fresh()->status);

        // No order access at all: the boards are forbidden.
        $this->as('seo_content_manager');
        $this->get(OrdersKanban::getUrl())->assertForbidden();
        $this->get(QuotesKanban::getUrl())->assertForbidden();
        Livewire::test(OrdersKanban::class)->assertForbidden();
        $this->assertSame('nouveau', $o->fresh()->status);
    }
}
