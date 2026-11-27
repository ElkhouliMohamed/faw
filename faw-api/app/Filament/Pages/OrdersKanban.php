<?php

namespace App\Filament\Pages;

use App\Filament\Pages\Concerns\HasKanbanBoard;
use App\Filament\Resources\CustomerOrders\OrderResource;
use App\Filament\Resources\ShopOrders\ShopOrderResource;
use App\Models\CustomerOrder;
use App\Models\Payment;
use App\Models\ShopOrder;
use App\Payments\PaymentProviders;
use App\Services\OrderService;
use App\Support\OrderStatus;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\ValidationException;
use Livewire\Attributes\Url;

/**
 * Order board: one column per status, drag a card to change its status.
 * Two sources: storefront orders (ShopOrder::changeStatus) and customer orders from accepted quotes
 * (OrderService::transition). Both write the history row and the audit trail, with the same role rules
 * as the order pages.
 */
class OrdersKanban extends Page
{
    use HasKanbanBoard;

    public const SOURCES = ['boutique' => 'Commandes du site', 'clients' => 'Commandes sur devis'];

    protected static ?string $navigationLabel = 'Commandes — Tableau';

    protected static ?string $title = 'Commandes — Tableau';

    protected static ?string $slug = 'commandes-tableau';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    protected static ?int $navigationSort = 11;

    protected string $view = 'filament.kanban.board';

    #[Url]
    public string $source = 'boutique';

    public static function canAccess(): bool
    {
        return (bool) auth()->user()?->canDo('view.orders');
    }

    public static function getNavigationBadge(): ?string
    {
        $n = ShopOrder::where('status', 'nouveau')->count();

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Nouvelles commandes à traiter';
    }

    public function getSubheading(): ?string
    {
        return 'Glissez une carte vers une autre colonne pour changer le statut (historique et journal d’audit mis à jour). Cliquez sur une carte pour ouvrir la commande.';
    }

    public function mount(): void
    {
        if (! array_key_exists($this->source, self::SOURCES)) {
            $this->source = 'boutique';
        }
    }

    public function updatedSource(): void
    {
        if (! array_key_exists($this->source, self::SOURCES)) {
            $this->source = 'boutique';
        }
        $this->payment = '';
    }

    /** @return array<string, string> */
    public function sources(): array
    {
        return self::SOURCES;
    }

    public function canMove(): bool
    {
        return $this->source === 'clients'
            ? OrderStatus::allowedFor($this->currentUser()) !== []
            : ShopOrder::canChangeStatus($this->currentUser());
    }

    /** @return array<string, string> */
    public function cityOptions(): array
    {
        $cities = $this->source === 'clients'
            ? CustomerOrder::query()->whereNotNull('city')->distinct()->orderBy('city')->pluck('city')
            : ShopOrder::query()->distinct()->orderBy('city')->pluck('city');

        return $cities->filter(fn ($c) => trim((string) $c) !== '')->mapWithKeys(fn ($c) => [$c => $c])->all();
    }

    /** @return array<string, string> */
    public function paymentOptions(): array
    {
        if ($this->source === 'clients') {
            $providers = app(PaymentProviders::class);

            return Payment::query()->distinct()->pluck('provider')->mapWithKeys(fn ($p) => [$p => $providers->get((string) $p)?->label() ?? (string) $p])->all();
        }
        $used = ShopOrder::query()->distinct()->pluck('paymentMethod')->filter()->mapWithKeys(fn ($m) => [$m => ShopOrder::paymentLabel($m)])->all();

        return $used + array_intersect_key(ShopOrder::PAYMENT_METHODS, ['virement' => 1, 'reception' => 1]);
    }

    public function hasPaymentFilter(): bool
    {
        return true;
    }

    /** @return list<array{key: string, label: string, color: string, count: int, droppable: bool, cards: list<array<string, mixed>>}> */
    public function board(): array
    {
        return $this->source === 'clients' ? $this->customerBoard() : $this->shopBoard();
    }

    public function listUrl(): string
    {
        return $this->source === 'clients' ? OrderResource::getUrl() : ShopOrderResource::getUrl();
    }

    protected function shopQuery(): Builder
    {
        $q = ShopOrder::query();
        $this->applySearch($q, ['number', 'customerName', 'company', 'phone', 'email', 'city']);
        if ($this->city !== '') {
            $q->where('city', $this->city);
        }
        if ($this->payment !== '') {
            $q->where('paymentMethod', $this->payment);
        }
        $this->applyDateRange($q, 'createdAt', ms: true);

        return $q;
    }

    protected function shopBoard(): array
    {
        $canMove = ShopOrder::canChangeStatus($this->currentUser());
        $base = $this->shopQuery();
        $counts = (clone $base)->toBase()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        $columns = [];
        foreach (ShopOrder::STATUSES as $key => $label) {
            $cards = (clone $base)->where('status', $key)->orderByDesc('createdAt')->limit(self::CARDS_PER_COLUMN)->get()
                ->map(fn (ShopOrder $o) => [
                    'id' => (string) $o->getKey(),
                    'title' => (string) $o->number,
                    'subtitle' => trim($o->customerName.($o->company ? ' · '.$o->company : '')),
                    'city' => (string) $o->city,
                    'amount' => static::money($o->total),
                    'meta' => ShopOrder::paymentLabel($o->paymentMethod),
                    'age' => static::age($o->createdAt),
                    'url' => ShopOrderResource::getUrl('view', ['record' => $o]),
                    'locked' => in_array($key, ShopOrder::FINAL, true) && ! $this->currentUser()?->canDo('*'),
                ])->all();
            $columns[] = ['key' => $key, 'label' => $label, 'color' => ShopOrderResource::statusColor($key), 'count' => (int) ($counts[$key] ?? 0), 'droppable' => $canMove, 'cards' => $cards];
        }

        return $columns;
    }

    protected function customerQuery(): Builder
    {
        $q = CustomerOrder::query();
        $this->applySearch($q, ['reference', 'client_name', 'phone', 'email', 'city']);
        if ($this->city !== '') {
            $q->where('city', $this->city);
        }
        if ($this->payment !== '') {
            $q->whereIn('id', Payment::query()->where('provider', $this->payment)->select('customer_order_id'));
        }
        $this->applyDateRange($q, 'created_at', ms: false);

        return $q;
    }

    protected function customerBoard(): array
    {
        $allowed = array_map(fn (OrderStatus $s) => $s->value, OrderStatus::allowedFor($this->currentUser()));
        $base = $this->customerQuery();
        $counts = (clone $base)->toBase()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        $providers = app(PaymentProviders::class);
        $columns = [];
        foreach (OrderStatus::cases() as $status) {
            $orders = (clone $base)->where('status', $status->value)->orderByDesc('created_at')->limit(self::CARDS_PER_COLUMN)->get();
            $methods = Payment::query()->whereIn('customer_order_id', $orders->modelKeys())->orderBy('position')->get(['customer_order_id', 'provider'])
                ->groupBy('customer_order_id')->map(fn ($ps) => $ps->pluck('provider')->unique()->map(fn ($p) => $providers->get((string) $p)?->label() ?? $p)->implode(', '));
            $cards = $orders->map(fn (CustomerOrder $o) => [
                'id' => (string) $o->getKey(),
                'title' => (string) $o->reference,
                'subtitle' => (string) $o->client_name,
                'city' => (string) ($o->city ?? ''),
                'amount' => static::money($o->total_ttc),
                'meta' => $methods[$o->getKey()] ?? 'Échéancier à définir',
                'age' => static::age($o->created_at),
                'url' => OrderResource::getUrl('view', ['record' => $o]),
                'locked' => $status->isFinal() && ! $this->currentUser()?->canDo('*'),
            ])->all();
            $columns[] = ['key' => $status->value, 'label' => $status->label(), 'color' => OrderResource::statusColor($status), 'count' => (int) ($counts[$status->value] ?? 0), 'droppable' => in_array($status->value, $allowed, true), 'cards' => $cards];
        }

        return $columns;
    }

    /**
     * Called by the board when a card is dropped on another column. Never writes the status itself:
     * delegates to the same service as the order pages, which checks the role and the transition.
     */
    public function moveCard(string|int $id, string $to): void
    {
        abort_unless(static::canAccess(), 403);
        try {
            if ($this->source === 'clients') {
                $status = OrderStatus::tryFrom($to) ?? throw ValidationException::withMessages(['status' => 'Statut inconnu.']);
                $order = CustomerOrder::find($id) ?? throw ValidationException::withMessages(['status' => 'Commande introuvable.']);
                if ($order->status === $status) {
                    return;
                }
                app(OrderService::class)->transition($order, $status, $this->currentUser(), 'Déplacée depuis le tableau des commandes.');
                $label = $order->reference;
                $toLabel = $status->label();
            } else {
                $order = ShopOrder::find($id) ?? throw ValidationException::withMessages(['status' => 'Commande introuvable.']);
                if ((string) $order->status === $to) {
                    return;
                }
                $order->changeStatus($to, $this->currentUser());
                $label = $order->number;
                $toLabel = ShopOrder::statusLabel($to);
            }
        } catch (ValidationException $e) {
            $this->notifyRefused($e);

            return;
        }
        Notification::make()->title('Commande '.$label.' : '.$toLabel)->success()->send();
    }
}
