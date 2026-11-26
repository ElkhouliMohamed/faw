<?php

namespace App\Filament\Resources\Carts;

use App\Filament\Resources\OwnerResource;
use App\Models\Cart;
use Filament\Actions\Action;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class CartResource extends OwnerResource
{
    protected static ?string $model = Cart::class;

    protected static ?string $slug = 'carts';

    protected static ?string $navigationLabel = 'Paniers abandonnés';

    protected static ?string $modelLabel = 'Paniers abandonnés';

    protected static ?string $pluralModelLabel = 'Paniers abandonnés';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

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
        return parent::getEloquentQuery()->where('itemCount', '>', 0)->where('status', '!=', 'récupéré')->whereRaw("CASE WHEN typeof(updatedAt)='integer' THEN CAST(updatedAt AS INTEGER)/1000 ELSE CAST(strftime('%s',updatedAt) AS INTEGER) END <= ?", [now()->subMinutes(30)->timestamp]);
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('id')->label('Panier')->maxLength(255)->disabled(), TextInput::make('name')->label('Nom')->maxLength(255)->disabled(), TextInput::make('phone')->label('Téléphone')->maxLength(255)->disabled(), TextInput::make('email')->label('Email')->maxLength(255)->disabled(), TextInput::make('subtotal')->label('Sous-total TTC')->maxLength(255)->disabled(), Select::make('status')->label('Suivi')->options(['ouvert' => 'À contacter', 'relancé' => 'Relance préparée / effectuée', 'perdu' => 'Perdu'])->required(), Textarea::make('items')->label('Produits demandés')->maxLength(12000)->columnSpanFull()->disabled()])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('id')->label('Panier')->limit(16), TextColumn::make('name')->label('Nom')->searchable(), TextColumn::make('phone')->label('Téléphone'), TextColumn::make('subtotal')->label('Sous-total')->suffix(' DH TTC'), TextColumn::make('status')->label('Suivi'), TextColumn::make('updatedAt')->label('Dernière activité')->dateTime('d/m/Y H:i')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Suivre'), Action::make('whatsapp')->label('Préparer une relance WhatsApp')->visible(fn ($record) => filled($record->phone))->url(function ($record) {
            $phone = preg_replace('/\D/', '', $record->phone);
            if (str_starts_with($phone, '0')) {
                $phone = '212'.substr($phone, 1);
            }

            return 'https://wa.me/'.$phone.'?text='.rawurlencode('Bonjour '.($record->name ?? '').', votre panier FAW est enregistré. Souhaitez-vous un renseignement sur les produits ?');
        })->openUrlInNewTab()->tooltip('Ouvre un brouillon WhatsApp. Aucun message envoyé automatiquement.')]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageCarts::route('/')];
    }
}
