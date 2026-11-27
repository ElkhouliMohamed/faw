<?php

namespace App\Filament\Resources\Carts;

use App\Filament\Resources\OwnerResource;
use App\Models\Cart;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CartResource extends OwnerResource
{
    protected static ?string $model = Cart::class;

    protected static ?string $slug = 'carts';

    protected static ?string $navigationLabel = 'Paniers abandonnés';

    protected static ?string $modelLabel = 'panier abandonné';

    protected static ?string $pluralModelLabel = 'Paniers abandonnés';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    /** @var array<string, string> */
    public const STATUSES = ['ouvert' => 'À contacter', 'relancé' => 'Relance préparée / effectuée', 'perdu' => 'Perdu'];

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('itemCount', '>', 0)->where('status', '!=', 'récupéré')->where('updatedAt', '<=', now()->subMinutes(30)->getTimestampMs()); // epoch milliseconds
    }

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Suivi de la relance')
                ->description('Seul le statut de suivi est modifiable : le contenu du panier provient du site.')
                ->schema([
                    Select::make('status')->label('Suivi')->options(self::STATUSES)->required()
                        ->helperText('Passez à « Relance préparée / effectuée » après avoir contacté le client.'),
                ])->columns($grid),
            Section::make('Client')
                ->description('Coordonnées saisies par le visiteur avant d’abandonner son panier.')
                ->schema([
                    TextInput::make('name')->label('Nom')->maxLength(255)->disabled(),
                    TextInput::make('phone')->label('Téléphone')->maxLength(255)->disabled(),
                    TextInput::make('email')->label('Email')->maxLength(255)->disabled(),
                    TextInput::make('id')->label('Panier')->maxLength(255)->disabled(),
                ])->columns($grid),
            Section::make('Contenu du panier')
                ->schema([
                    TextInput::make('subtotal')->label('Sous-total TTC')->maxLength(255)->suffix('DH')->disabled(),
                    Textarea::make('items')->label('Produits demandés')->maxLength(12000)->rows(6)->columnSpanFull()->disabled(),
                ])->columns($grid),
        ])->columns(1);
    }

    /** Opens a WhatsApp draft for the customer; nothing is sent automatically. */
    public static function whatsappAction(): Action
    {
        return Action::make('whatsapp')->label('Préparer une relance WhatsApp')->icon('heroicon-o-chat-bubble-oval-left')->visible(fn ($record) => filled($record?->phone))->url(function ($record) {
            $phone = preg_replace('/\D/', '', $record->phone);
            if (str_starts_with($phone, '0')) {
                $phone = '212'.substr($phone, 1);
            }

            return 'https://wa.me/'.$phone.'?text='.rawurlencode('Bonjour '.($record->name ?? '').', votre panier FAW est enregistré. Souhaitez-vous un renseignement sur les produits ?');
        })->openUrlInNewTab()->tooltip('Ouvre un brouillon WhatsApp. Aucun message envoyé automatiquement.');
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('id')->label('Panier')->limit(16),
            TextColumn::make('name')->label('Nom')->searchable(),
            TextColumn::make('phone')->label('Téléphone')->searchable(),
            TextColumn::make('subtotal')->label('Sous-total')->suffix(' DH TTC')->sortable(),
            TextColumn::make('status')->label('Suivi')->badge()->formatStateUsing(fn ($state) => self::STATUSES[$state] ?? $state),
            TextColumn::make('updatedAt')->label('Dernière activité')->dateTime('d/m/Y H:i')->sortable(),
        ])->defaultSort('updatedAt', 'desc')
            ->filters([
                SelectFilter::make('status')->label('Suivi')->options(self::STATUSES),
            ])
            ->recordActions([EditAction::make()->label('Suivre'), self::whatsappAction()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCarts::route('/'),
            'view' => Pages\ViewCart::route('/{record}'),
            'edit' => Pages\EditCart::route('/{record}/edit'),
        ];
    }
}
