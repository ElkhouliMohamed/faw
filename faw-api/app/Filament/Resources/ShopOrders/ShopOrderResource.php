<?php

namespace App\Filament\Resources\ShopOrders;

use App\Filament\Resources\OwnerResource;
use App\Models\Activity;
use App\Models\ShopOrder;
use App\Models\User;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Infolists\Components\TextEntry;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\HtmlString;
use Illuminate\Validation\ValidationException;

/**
 * Storefront orders / requests (checkout). Read: view.orders. Write (status, team notes): write.orders, write.finance.
 * Status changes always go through ShopOrder::changeStatus (audit + LeadEvent history).
 */
class ShopOrderResource extends OwnerResource
{
    protected static ?string $model = ShopOrder::class;

    protected static ?string $navigationLabel = 'Commandes / demandes';

    protected static ?string $modelLabel = 'commande / demande';

    protected static ?string $pluralModelLabel = 'Commandes / demandes';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    protected static ?int $navigationSort = 10;

    protected static ?string $recordTitleAttribute = 'number';

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
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

    protected static function user(): ?User
    {
        $u = auth()->user();

        return $u instanceof User ? $u : null;
    }

    public static function statusColor(?string $status): string
    {
        return match ($status) {
            'nouveau' => 'warning',
            'à contacter', 'devis envoyé' => 'info',
            'en cours' => 'primary',
            'confirmé', 'livré' => 'success',
            'annulé' => 'danger',
            default => 'gray',
        };
    }

    /** @return array<string, string> */
    public static function statusOptions(?ShopOrder $record = null): array
    {
        $options = ShopOrder::STATUSES;
        if ($record && $record->status && ! isset($options[$record->status])) {
            $options = [$record->status => $record->status] + $options; // legacy value kept visible
        }

        return $options;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Traitement')
                ->description('Seuls le statut et les notes de l’équipe sont modifiables. Chaque changement de statut est historisé.')
                ->schema([
                    Select::make('status')->label('Statut')->options(fn (?ShopOrder $record) => static::statusOptions($record))->required()->native(false)
                        ->helperText('« Livré » et « Annulé » sont des statuts finaux : seul un super administrateur peut en sortir.'),
                    TextInput::make('number')->label('Référence')->disabled()->dehydrated(false),
                    Textarea::make('notes')->label('Notes équipe')->helperText('Visible uniquement dans le back-office.')->maxLength(5000)->rows(4)->columnSpanFull(),
                ])->columns(2),
            Section::make('Client')->schema([
                TextInput::make('customerName')->label('Client')->disabled()->dehydrated(false),
                TextInput::make('company')->label('Société')->disabled()->dehydrated(false),
                TextInput::make('phone')->label('Téléphone')->disabled()->dehydrated(false),
                TextInput::make('email')->label('Email')->disabled()->dehydrated(false),
                TextInput::make('city')->label('Ville')->disabled()->dehydrated(false),
                Textarea::make('address')->label('Adresse')->disabled()->dehydrated(false)->columnSpanFull(),
            ])->columns(2),
            Section::make('Commande')->schema([
                TextInput::make('total')->label('Total TTC (DH)')->disabled()->dehydrated(false),
                TextInput::make('paymentMethod')->label('Paiement')->formatStateUsing(fn ($state) => ShopOrder::paymentLabel($state))->disabled()->dehydrated(false),
                Textarea::make('deliveryNote')->label('Transport')->disabled()->dehydrated(false)->columnSpanFull(),
                Textarea::make('quoteRefusal')->label('Contrôles équipe')->disabled()->dehydrated(false)->columnSpanFull(),
                Textarea::make('line_details')->label('Articles')->formatStateUsing(fn ($record) => $record ? DB::table('OrderItem')->where('orderId', $record->id)->get()->map(fn ($l) => $l->quantity.' × '.$l->title.' — '.$l->lineTotal.' DH TTC')->implode("\n") : '')->disabled()->dehydrated(false)->columnSpanFull(),
            ])->columns(2)->collapsible(),
        ]);
    }

    public static function infolist(Schema $schema): Schema
    {
        $dh = fn ($state) => $state === null || $state === '' ? '—' : number_format((int) $state, 0, ',', ' ').' DH';

        return $schema->components([
            Section::make('Commande')->schema([
                TextEntry::make('number')->label('Référence')->copyable()->weight('bold'),
                TextEntry::make('status')->label('Statut')->badge()->formatStateUsing(fn ($state) => ShopOrder::statusLabel($state))->color(fn ($state) => static::statusColor($state)),
                TextEntry::make('createdAt')->label('Reçue le')->dateTime('d/m/Y H:i', 'Africa/Casablanca'),
                TextEntry::make('paymentMethod')->label('Mode de paiement')->formatStateUsing(fn ($state) => ShopOrder::paymentLabel($state)),
                TextEntry::make('deliveryMode')->label('Livraison')->placeholder('—'),
                TextEntry::make('deliveryNote')->label('Transport')->placeholder('—'),
                TextEntry::make('subtotal')->label('Sous-total TTC')->formatStateUsing($dh),
                TextEntry::make('deliveryFee')->label('Frais de livraison')->formatStateUsing($dh),
                TextEntry::make('couponCode')->label('Code promo')->placeholder('—')->formatStateUsing(fn ($state, $record) => $state.' (−'.(int) $record->couponDiscount.' DH)'),
                TextEntry::make('total')->label('Total TTC')->formatStateUsing($dh)->weight('bold'),
            ])->columns(['default' => 1, 'md' => 2, 'xl' => 3])->columnSpanFull(),
            Section::make('Client')->schema([
                TextEntry::make('customerName')->label('Client'),
                TextEntry::make('company')->label('Société')->placeholder('—'),
                TextEntry::make('ice')->label('ICE')->placeholder('—'),
                TextEntry::make('phone')->label('Téléphone')->copyable(),
                TextEntry::make('email')->label('Email')->placeholder('—')->copyable(),
                TextEntry::make('city')->label('Ville'),
                TextEntry::make('address')->label('Adresse')->placeholder('—')->columnSpanFull(),
            ])->columns(['default' => 1, 'md' => 2]),
            Section::make('Articles')->schema([
                TextEntry::make('items_html')->hiddenLabel()->state(fn (ShopOrder $record) => static::itemsHtml($record))->html()->columnSpanFull(),
            ]),
            Section::make('Suivi équipe')->schema([
                TextEntry::make('quoteRefusal')->label('Contrôles automatiques')->placeholder('Aucun')->columnSpanFull(),
                TextEntry::make('notes')->label('Notes équipe')->placeholder('Aucune note')->columnSpanFull(),
                TextEntry::make('history_html')->label('Historique des statuts')->state(fn (ShopOrder $record) => static::historyHtml($record))->html()->columnSpanFull(),
            ]),
            Section::make('Provenance')->schema([
                TextEntry::make('origin')->label('Origine')->placeholder('—'),
                TextEntry::make('utmSource')->label('Source')->placeholder('—'),
                TextEntry::make('utmMedium')->label('Support')->placeholder('—'),
                TextEntry::make('utmCampaign')->label('Campagne')->placeholder('—'),
            ])->columns(['default' => 1, 'md' => 4])->collapsed()->columnSpanFull(),
        ])->columns(['default' => 1, 'lg' => 2]);
    }

    public static function itemsHtml(ShopOrder $o): HtmlString
    {
        $rows = DB::table('OrderItem')->where('orderId', $o->id)->orderBy('id')->get()
            ->map(fn ($l) => '<tr><td>'.e($l->quantity).'</td><td>'.e($l->title).'</td><td style="text-align:right">'.e($l->unitPrice).'</td><td style="text-align:right">'.e($l->lineTotal).'</td></tr>')->implode('');

        return new HtmlString('<table style="width:100%;font-size:13px"><thead><tr style="text-align:left"><th>Qté</th><th>Article</th><th style="text-align:right">PU TTC (DH)</th><th style="text-align:right">Total TTC (DH)</th></tr></thead><tbody>'.($rows ?: '<tr><td colspan="4">Aucun article.</td></tr>').'</tbody></table>');
    }

    public static function historyHtml(ShopOrder $o): HtmlString
    {
        $items = Activity::where('orderId', $o->id)->orderBy('id')->get()->map(function ($a) {
            $from = $a->fromStatus ? ShopOrder::statusLabel($a->fromStatus).' → ' : '';

            return '<li>'.e($a->createdAt?->setTimezone('Africa/Casablanca')->format('d/m/Y H:i')).' — '.e($from.ShopOrder::statusLabel($a->toStatus)).'</li>';
        })->implode('');

        return new HtmlString('<ul style="font-size:13px">'.($items ?: '<li>Aucun changement enregistré.</li>').'</ul>');
    }

    public static function changeStatusAction(): Action
    {
        return Action::make('changerStatut')->label('Changer le statut')->icon('heroicon-o-arrow-path')
            ->visible(fn () => ShopOrder::canChangeStatus(static::user()))
            ->modalDescription('Le changement est enregistré dans l’historique de la commande et dans le journal d’audit.')
            ->fillForm(fn (ShopOrder $record) => ['status' => $record->status])
            ->schema([Select::make('status')->label('Nouveau statut')->options(fn (ShopOrder $record) => static::statusOptions($record))->required()->native(false)])
            ->action(function (ShopOrder $record, array $data) {
                try {
                    $record->changeStatus((string) $data['status'], static::user());
                    Notification::make()->title('Statut mis à jour')->success()->send();
                } catch (ValidationException $e) {
                    Notification::make()->title('Statut refusé')->body(collect($e->errors())->flatten()->implode(' ; '))->danger()->send();
                }
            });
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('number')->label('Référence')->searchable()->weight('bold'),
            TextColumn::make('customerName')->label('Client')->searchable()->description(fn (ShopOrder $record) => $record->company ?: null),
            TextColumn::make('city')->label('Ville')->searchable()->toggleable(),
            TextColumn::make('status')->label('Statut')->badge()->formatStateUsing(fn ($state) => ShopOrder::statusLabel($state))->color(fn ($state) => static::statusColor($state)),
            TextColumn::make('paymentMethod')->label('Paiement')->formatStateUsing(fn ($state) => ShopOrder::paymentLabel($state))->toggleable(),
            TextColumn::make('total')->label('Total')->suffix(' DH TTC')->sortable(),
            TextColumn::make('createdAt')->label('Date')->dateTime('d/m/Y H:i', 'Africa/Casablanca')->sortable(),
        ])->defaultSort('createdAt', 'desc')
            ->filters([
                SelectFilter::make('status')->label('Statut')->options(ShopOrder::STATUSES),
                SelectFilter::make('paymentMethod')->label('Paiement')->options(ShopOrder::PAYMENT_METHODS),
            ])
            ->recordActions([ViewAction::make()->label('Ouvrir'), EditAction::make()->label('Modifier')]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListShopOrders::route('/'),
            'view' => Pages\ViewShopOrder::route('/{record}'),
            'edit' => Pages\EditShopOrder::route('/{record}/edit'),
        ];
    }
}
