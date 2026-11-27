<?php

namespace App\Filament\Resources\CustomerOrders;

use App\Filament\Resources\OwnerResource;
use App\Models\CustomerOrder;
use App\Models\Payment;
use App\Models\User;
use App\Payments\BankTransferProvider;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Support\OrderStatus;
use App\Support\PaymentStatus;
use Filament\Actions\Action;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;

/**
 * Customer orders (from accepted quotes). Read: view.orders. Status: sales manager / super admin all,
 * logistics (write.shipping) delivery steps, finance (write.finance) payment steps. Viewer read-only.
 */
class OrderResource extends OwnerResource
{
    protected static ?string $model = CustomerOrder::class;

    protected static ?string $slug = 'customer-orders';

    protected static ?string $navigationLabel = 'Commandes clients';

    protected static ?string $modelLabel = 'Commande client';

    protected static ?string $pluralModelLabel = 'Commandes clients';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    protected static ?int $navigationSort = 12;

    protected static ?string $recordTitleAttribute = 'reference';

    /** Orders with a payment proof waiting for finance. */
    public static function getNavigationBadge(): ?string
    {
        $n = CustomerOrder::whereIn('id', Payment::where('status', PaymentStatus::PendingVerification->value)->select('customer_order_id'))->count();

        return $n > 0 ? (string) $n : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
    }

    public static function getNavigationBadgeTooltip(): ?string
    {
        return 'Commandes avec un justificatif de paiement à vérifier';
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false; // changes go through the audited actions below
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    protected static function user(): ?User
    {
        $u = auth()->user();

        return $u instanceof User ? $u : null;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([Tabs::make('commande')->tabs([
            Tab::make('Commande')->schema([
                TextEntry::make('reference')->label('Référence'),
                TextEntry::make('status')->label('Statut')->formatStateUsing(fn ($state) => $state instanceof OrderStatus ? $state->label() : $state)->badge()->color(fn ($state) => static::statusColor($state)),
                TextEntry::make('client_name')->label('Client'),
                TextEntry::make('city')->label('Ville'),
                TextEntry::make('version_number')->label('Version du devis acceptée'),
                TextEntry::make('total_ttc')->label('Total TTC')->formatStateUsing(fn ($state, $record) => $state.' '.$record->currency.' (TVA '.$record->tax_rate.' % incluse)'),
                TextEntry::make('fulfilment')->label('Mode')->formatStateUsing(fn ($state) => $state === 'retrait' ? 'Retrait' : 'Livraison'),
                TextEntry::make('delivery_address')->label('Adresse de livraison')->placeholder('—'),
                TextEntry::make('lines_html')->label('Lignes (copiées du devis accepté)')->state(fn ($record) => static::linesHtml($record))->html()->columnSpanFull(),
            ])->columns(2),
            Tab::make('Paiements')->schema([
                TextEntry::make('payments_html')->hiddenLabel()->state(fn ($record) => static::paymentsHtml($record))->html()->columnSpanFull(),
            ]),
            Tab::make('Historique')->schema([
                TextEntry::make('history_html')->hiddenLabel()->state(fn ($record) => static::historyHtml($record))->html()->columnSpanFull(),
            ]),
        ])->columnSpanFull()]);
    }

    public static function statusColor(mixed $state): string
    {
        return match ($state instanceof OrderStatus ? $state : OrderStatus::tryFrom((string) $state)) {
            OrderStatus::AwaitingPayment, OrderStatus::PartiallyPaid => 'warning',
            OrderStatus::PaymentConfirmed, OrderStatus::Processing, OrderStatus::Preparing => 'info',
            OrderStatus::ReadyForPickup, OrderStatus::InDelivery => 'primary',
            OrderStatus::Delivered, OrderStatus::Completed => 'success',
            OrderStatus::Cancelled => 'danger',
            default => 'gray',
        };
    }

    public static function linesHtml(CustomerOrder $o): HtmlString
    {
        $rows = collect($o->lines)->map(fn ($l) => '<tr><td>'.e($l['qty']).'</td><td>'.e($l['reference']).' — '.e($l['name']).'</td><td style="text-align:right">'.e($l['unit_ttc']).'</td><td style="text-align:right">'.e($l['total_ttc']).'</td></tr>')->implode('');
        $d = $o->delivery;

        return new HtmlString('<table style="width:100%;font-size:13px"><thead><tr><th>Qté</th><th>Article</th><th style="text-align:right">PU TTC</th><th style="text-align:right">Total TTC</th></tr></thead><tbody>'.$rows.'</tbody></table>'
            .'<p style="font-size:13px;margin-top:8px">Livraison (hors total) : '.e($d['label'] ?? '—').'</p>');
    }

    public static function historyHtml(CustomerOrder $o): HtmlString
    {
        $items = $o->history()->get()->map(function ($h) {
            $to = OrderStatus::tryFrom($h->to_status)?->label() ?? $h->to_status;
            $from = $h->from_status ? (OrderStatus::tryFrom($h->from_status)?->label() ?? $h->from_status).' → ' : '';
            $who = $h->user_id ? (User::find($h->user_id)?->name ?? '#'.$h->user_id) : ($h->source === 'payment' ? 'paiement' : 'système');

            return '<li>'.e($h->created_at?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i')).' — '.e($from.$to).' ('.e($who).')'.($h->note ? ' : '.e($h->note) : '').'</li>';
        })->implode('');

        return new HtmlString('<ul style="font-size:13px">'.$items.'</ul>');
    }

    public static function paymentsHtml(CustomerOrder $o): HtmlString
    {
        $rows = Payment::where('customer_order_id', $o->id)->orderBy('id')->get()->map(function (Payment $p) {
            $proof = $p->proof_path && PaymentService::canSchedule(static::user()) ? ' — <a style="text-decoration:underline" target="_blank" rel="noopener" href="'.e(route('admin.payment.proof', $p)).'">justificatif</a>' : '';
            $tx = $p->transactions->map(fn ($t) => '<li>'.e($t->created_at?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i')).' — '.e($t->type).($t->to_status ? ' → '.e(PaymentStatus::from($t->to_status)->label()) : '').' ('.e($t->user_id ? (User::find($t->user_id)?->name ?? '#'.$t->user_id) : $t->source).')'.($t->note ? ' : '.e($t->note) : '').'</li>')->implode('');

            return '<li style="margin-bottom:8px"><strong>'.e($p->label).'</strong> — '.e($p->amount).' '.e($p->currency).' — réf. <code>'.e($p->reference).'</code> — '.e($p->status->label()).$proof.'<ul style="margin-left:16px;opacity:.8">'.$tx.'</ul></li>';
        })->implode('');
        $bank = BankTransferProvider::bank();

        return new HtmlString('<ul style="font-size:13px">'.($rows ?: '<li>Aucun paiement.</li>').'</ul><p style="font-size:12px;opacity:.7">RIB affiché au client : '.e($bank['rib'] ?? 'non configuré (« RIB communiqué par FAW »)').'. Paiement par carte : désactivé.</p>');
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('reference')->label('Référence')->searchable()->sortable(),
            TextColumn::make('client_name')->label('Client')->searchable(),
            TextColumn::make('city')->label('Ville')->searchable()->toggleable(),
            TextColumn::make('version_number')->label('Devis'),
            TextColumn::make('total_ttc')->label('Total')->suffix(' DH TTC'),
            TextColumn::make('status')->label('Statut')->badge()->formatStateUsing(fn ($state) => $state instanceof OrderStatus ? $state->label() : $state)->color(fn ($state) => static::statusColor($state)),
            TextColumn::make('fulfilment')->label('Mode')->formatStateUsing(fn ($state) => $state === 'retrait' ? 'Retrait' : 'Livraison'),
            TextColumn::make('created_at')->label('Créée le')->dateTime('d/m/Y H:i', 'Africa/Casablanca')->sortable(),
        ])->defaultSort('created_at', 'desc')
            ->filters([SelectFilter::make('status')->label('Statut')->options(OrderStatus::options())])
            ->recordActions(static::recordActions());
    }

    /** @return list<Action> */
    public static function recordActions(): array
    {
        return [...static::baseActions(), ...static::paymentActions()];
    }

    /** @return list<Action> */
    public static function baseActions(): array
    {
        return [ViewAction::make()->label('Ouvrir'), ...static::statusActions()];
    }

    /** @return list<Action> */
    public static function statusActions(): array
    {
        return [
            Action::make('changerStatut')->label('Changer le statut')
                ->visible(fn () => OrderStatus::allowedFor(static::user()) !== [])
                ->schema([
                    Select::make('status')->label('Nouveau statut')->options(fn () => OrderStatus::options(OrderStatus::allowedFor(static::user())))->required(),
                    Textarea::make('note')->label('Note (historique)')->maxLength(500),
                ])
                ->action(function (CustomerOrder $record, array $data) {
                    try {
                        app(OrderService::class)->transition($record, OrderStatus::from($data['status']), static::user(), $data['note'] ?? null);
                        Notification::make()->title('Statut mis à jour')->success()->send();
                    } catch (ValidationException $e) {
                        Notification::make()->title('Statut refusé')->body(collect($e->errors())->flatten()->implode(' ; '))->danger()->send();
                    }
                }),
            Action::make('livraison')->label('Retrait / livraison')
                ->visible(fn () => (bool) (static::user()?->canDo('manage.customer_orders') || static::user()?->canDo('write.shipping')))
                ->fillForm(fn (CustomerOrder $record) => ['fulfilment' => $record->fulfilment, 'delivery_address' => $record->delivery_address, 'delivery_note' => $record->delivery_note])
                ->schema([
                    Select::make('fulfilment')->label('Mode')->options(['retrait' => 'Retrait', 'livraison' => 'Livraison'])->required()->live(),
                    Textarea::make('delivery_address')->label('Adresse de livraison')->maxLength(1000)->visible(fn ($get) => $get('fulfilment') === 'livraison'),
                    Textarea::make('delivery_note')->label('Note logistique')->maxLength(500),
                ])
                ->action(function (CustomerOrder $record, array $data) {
                    abort_unless(static::user()?->canDo('manage.customer_orders') || static::user()?->canDo('write.shipping'), 403);
                    app(OrderService::class)->updateFulfilment($record, $data['fulfilment'], $data['delivery_address'] ?? null, $data['delivery_note'] ?? null, static::user());
                    Notification::make()->title('Retrait / livraison mis à jour')->success()->send();
                }),
        ];
    }

    /** @return list<Action> */
    public static function paymentActions(): array
    {
        $pending = fn (CustomerOrder $o, array $statuses) => Payment::where('customer_order_id', $o->id)->whereIn('status', $statuses)->orderBy('position')->get()->mapWithKeys(fn ($p) => [$p->id => $p->reference.' — '.$p->label.' — '.$p->amount.' '.$p->currency.' ('.$p->status->label().')'])->all();

        return [
            Action::make('echeancier')->label('Échéancier')
                ->visible(fn () => PaymentService::canSchedule(static::user()))
                ->modalDescription(fn (CustomerOrder $record) => 'Total de la commande : '.$record->total_ttc.' '.$record->currency.'. Les montants sont saisis par FAW et doivent faire exactement ce total (ni frais ni intérêts).')
                ->schema([
                    Select::make('mode')->label('Type')->options(['integral' => 'Paiement intégral', 'acompte' => 'Acompte + solde', 'plusieurs' => 'Plusieurs échéances'])->default('integral')->required()->live(),
                    TextInput::make('deposit')->label('Montant de l’acompte (DH)')->integer()->minValue(1)->visible(fn ($get) => $get('mode') === 'acompte')->required(fn ($get) => $get('mode') === 'acompte'),
                    Repeater::make('parts')->label('Échéances')->visible(fn ($get) => $get('mode') === 'plusieurs')->minItems(2)->maxItems(PaymentService::MAX_PARTS)->defaultItems(2)
                        ->schema([TextInput::make('label')->label('Libellé')->maxLength(120), TextInput::make('amount')->label('Montant (DH)')->integer()->minValue(1)->required()])->columns(2),
                    Textarea::make('note')->label('Note (historique)')->maxLength(500),
                ])
                ->action(function (CustomerOrder $record, array $data) {
                    $parts = match ($data['mode']) {
                        'acompte' => [['label' => 'Acompte', 'amount' => (int) $data['deposit']], ['label' => 'Solde', 'amount' => $record->total_ttc - (int) $data['deposit']]],
                        'plusieurs' => array_values($data['parts'] ?? []),
                        default => [['label' => 'Paiement intégral', 'amount' => $record->total_ttc]],
                    };
                    try {
                        app(PaymentService::class)->setSchedule($record, $parts, static::user(), $data['note'] ?? null);
                        Notification::make()->title('Échéancier enregistré')->success()->send();
                    } catch (ValidationException $e) {
                        Notification::make()->title('Échéancier refusé')->body(collect($e->errors())->flatten()->implode(' ; '))->danger()->send();
                    }
                }),
            Action::make('validerPaiement')->label('Valider un paiement')->color('success')
                ->visible(fn () => PaymentService::canValidate(static::user()))
                ->schema([
                    Select::make('payment')->label('Paiement reçu')->options(fn (CustomerOrder $record) => $pending($record, [PaymentStatus::PendingVerification->value, PaymentStatus::Awaiting->value]))->required(),
                    Textarea::make('note')->label('Note (ex. date de réception du virement)')->maxLength(500),
                ])
                ->action(function (CustomerOrder $record, array $data) {
                    abort_unless(PaymentService::canValidate(static::user()), 403);
                    try {
                        app(PaymentService::class)->confirm(Payment::where('customer_order_id', $record->id)->findOrFail($data['payment']), static::user(), $data['note'] ?? null);
                        Notification::make()->title('Paiement confirmé')->success()->send();
                    } catch (ValidationException $e) {
                        Notification::make()->title('Validation refusée')->body(collect($e->errors())->flatten()->implode(' ; '))->danger()->send();
                    }
                }),
            Action::make('rejeterJustificatif')->label('Refuser un justificatif')->color('danger')
                ->visible(fn () => PaymentService::canValidate(static::user()))
                ->schema([
                    Select::make('payment')->label('Justificatif')->options(fn (CustomerOrder $record) => $pending($record, [PaymentStatus::PendingVerification->value]))->required(),
                    Textarea::make('note')->label('Motif (visible dans l’historique)')->required()->maxLength(500),
                ])
                ->action(function (CustomerOrder $record, array $data) {
                    abort_unless(PaymentService::canValidate(static::user()), 403);
                    try {
                        app(PaymentService::class)->reject(Payment::where('customer_order_id', $record->id)->findOrFail($data['payment']), static::user(), (string) $data['note']);
                        Notification::make()->title('Justificatif refusé')->success()->send();
                    } catch (ValidationException $e) {
                        Notification::make()->title('Refus impossible')->body(collect($e->errors())->flatten()->implode(' ; '))->danger()->send();
                    }
                }),
        ];
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCustomerOrders::route('/'),
            'view' => Pages\ViewCustomerOrder::route('/{record}'),
        ];
    }
}
