<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\CustomerOrders\OrderResource;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Filament\Resources\ShopOrders\ShopOrderResource;
use Carbon\CarbonImmutable;
use Filament\Actions\Action;
use Filament\Resources\Resource;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Support\Facades\DB;

/**
 * "À traiter": newest items waiting for the team, each linked to its page.
 * Only the kinds the user may open are listed (same rules as the resources themselves).
 */
class PendingActions extends TableWidget
{
    protected static bool $isDiscovered = false;

    protected static ?int $sort = 2;

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'À traiter';

    /** Rows fetched per kind (newest first); the table keeps the newest overall. */
    private const PER_KIND = 10;

    private const MAX_ROWS = 12;

    public static function canView(): bool
    {
        return QuoteResource::canViewAny() || ShopOrderResource::canViewAny() || OrderResource::canViewAny();
    }

    public function table(Table $table): Table
    {
        return $table
            ->description('Les demandes les plus récentes qui attendent une action de l’équipe. Cliquez sur une ligne pour l’ouvrir.')
            ->records(fn (): array => $this->rows())
            ->columns([
                TextColumn::make('kind')->label('À faire')->badge()->color(fn (array $record) => $record['color']),
                TextColumn::make('reference')->label('Référence')->wrap(),
                TextColumn::make('client')->label('Client')->wrap(),
                TextColumn::make('city')->label('Ville')->placeholder('—'),
                TextColumn::make('amount')->label('Montant')->formatStateUsing(fn ($state) => $state === null ? '—' : number_format((int) $state, 0, ',', ' ').' MAD')->alignEnd(),
                TextColumn::make('at')->label('Reçu')->since()->dateTimeTooltip('d/m/Y H:i', 'Africa/Casablanca'),
            ])
            ->recordUrl(fn (array $record): ?string => $record['url'])
            ->recordActions([
                Action::make('open')->label('Ouvrir')->icon('heroicon-o-arrow-right')->url(fn (array $record): ?string => $record['url'])->visible(fn (array $record): bool => $record['url'] !== null),
            ])
            ->emptyStateHeading('Rien à traiter')
            ->emptyStateDescription('Aucune demande de devis à valider, aucune commande nouvelle et aucun paiement à vérifier.')
            ->emptyStateIcon('heroicon-o-check-circle')
            ->paginated(false);
    }

    /** @return array<string, array<string, mixed>> */
    protected function rows(): array
    {
        $rows = [];
        $ms = fn ($v) => $v === null ? null : CarbonImmutable::createFromTimestampMs((int) $v, 'UTC');

        if (QuoteResource::canViewAny()) {
            foreach (DB::table('Quote')->where('status', 'à valider')->orderByDesc('createdAt')->limit(self::PER_KIND)->get(['id', 'clientName', 'city', 'totalTtc', 'createdAt']) as $q) {
                $rows[] = ['__key' => 'quote-'.$q->id, 'kind' => 'Devis à valider', 'color' => 'warning', 'reference' => 'Demande n° '.$q->id, 'client' => (string) $q->clientName, 'city' => $q->city, 'amount' => $q->totalTtc, 'at' => $ms($q->createdAt), 'url' => $this->recordUrl(QuoteResource::class, $q->id)];
            }
        }

        if (ShopOrderResource::canViewAny()) {
            $orders = DB::table('Order as o')->whereIn('o.status', ['nouveau', 'à contacter'])
                ->whereNotExists(fn ($q) => $q->select(DB::raw(1))->from('Quote as q')->whereColumn('q.orderId', 'o.id'))
                ->orderByDesc('o.createdAt')->limit(self::PER_KIND)->get(['o.id', 'o.number', 'o.status', 'o.customerName', 'o.city', 'o.total', 'o.createdAt']);
            foreach ($orders as $o) {
                $rows[] = ['__key' => 'order-'.$o->id, 'kind' => $o->status === 'nouveau' ? 'Commande à confirmer' : 'Client à contacter', 'color' => 'info', 'reference' => (string) $o->number, 'client' => (string) $o->customerName, 'city' => $o->city, 'amount' => $o->total, 'at' => $ms($o->createdAt), 'url' => $this->recordUrl(ShopOrderResource::class, $o->id)];
            }
        }

        if (OrderResource::canViewAny()) {
            $payments = DB::table('payments as p')->join('customer_orders as co', 'co.id', '=', 'p.customer_order_id')
                ->where('p.status', 'en_verification')
                ->orderByDesc('p.updated_at')->limit(self::PER_KIND)
                ->get(['p.id', 'p.amount', 'p.proof_uploaded_at', 'p.updated_at', 'co.id as order_id', 'co.reference', 'co.client_name', 'co.city']);
            foreach ($payments as $p) {
                $rows[] = ['__key' => 'payment-'.$p->id, 'kind' => 'Paiement à vérifier', 'color' => 'success', 'reference' => (string) $p->reference, 'client' => (string) $p->client_name, 'city' => $p->city, 'amount' => $p->amount, 'at' => CarbonImmutable::parse($p->proof_uploaded_at ?? $p->updated_at, 'UTC'), 'url' => $this->recordUrl(OrderResource::class, $p->order_id)];
            }
        }

        usort($rows, fn (array $a, array $b) => ($b['at']?->getTimestamp() ?? 0) <=> ($a['at']?->getTimestamp() ?? 0));

        return array_column(array_slice($rows, 0, self::MAX_ROWS), null, '__key');
    }

    /** View page when it exists, else edit, else the list (resources are moving to full-page screens). */
    protected function recordUrl(string $resource, int|string $id): ?string
    {
        /** @var class-string<resource> $resource */
        foreach (['view', 'edit'] as $page) {
            if ($resource::hasPage($page)) {
                return $resource::getUrl($page, ['record' => $id]);
            }
        }

        return $resource::hasPage('index') ? $resource::getUrl('index') : null;
    }
}
