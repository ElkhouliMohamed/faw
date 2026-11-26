<?php

namespace App\Filament\Resources\ShippingCitys;

use App\Filament\Resources\OwnerResource;
use App\Models\ShippingCity;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class ShippingCityResource extends OwnerResource
{
    protected static ?string $model = ShippingCity::class;

    protected static ?string $slug = 'shippingcitys';

    protected static ?string $navigationLabel = 'Villes de livraison';

    protected static ?string $modelLabel = 'Villes de livraison';

    protected static ?string $pluralModelLabel = 'Villes de livraison';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('name')->label('Ville')->maxLength(255)->required(), TextInput::make('slug')->label('Identifiant')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true), TextInput::make('fee')->label('Frais TTC (DH), vide = sur devis')->maxLength(255)->integer()->minValue(0)->nullable(), Toggle::make('available')->label('Livraison disponible')->default(true), TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required(), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('name')->label('Ville')->searchable(), TextColumn::make('fee')->label('Frais TTC')->suffix(' DH TTC')->placeholder('Sur devis'), IconColumn::make('available')->label('Disponible')->boolean()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageShippingCitys::route('/')];
    }
}
