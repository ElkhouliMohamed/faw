<?php

namespace App\Filament\Resources\ShippingCitys;

use App\Filament\Resources\OwnerResource;
use App\Models\ShippingCity;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class ShippingCityResource extends OwnerResource
{
    protected static ?string $model = ShippingCity::class;

    protected static ?string $slug = 'shippingcitys';

    protected static ?string $navigationLabel = 'Villes de livraison';

    protected static ?string $modelLabel = 'ville de livraison';

    protected static ?string $pluralModelLabel = 'Villes de livraison';

    protected static ?string $recordTitleAttribute = 'name';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Ville')
                ->description('Ville proposée au client lors de la commande.')
                ->schema([
                    TextInput::make('name')->label('Ville')->maxLength(255)->required(),
                    TextInput::make('slug')->label('Identifiant')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true)
                        ->placeholder('casablanca')->helperText('Minuscules, chiffres et tirets uniquement. Utilisé par les règles de frais.'),
                    TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required()
                        ->helperText('Les villes sont listées par ordre croissant.'),
                    Toggle::make('active')->label('Actif')->default(false)->inline(false),
                ])->columns($grid),
            Section::make('Livraison')
                ->description('Frais standards de livraison pour cette ville.')
                ->schema([
                    TextInput::make('fee')->label('Frais TTC (DH), vide = sur devis')->maxLength(255)->integer()->minValue(0)->nullable()
                        ->helperText('Laissez vide si la livraison est chiffrée au cas par cas.'),
                    Toggle::make('available')->label('Livraison disponible')->default(true)->inline(false),
                ])->columns($grid),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->label('Ville')->searchable()->sortable()->weight('bold'),
            TextColumn::make('fee')->label('Frais TTC')->suffix(' DH TTC')->placeholder('Sur devis')->sortable(),
            IconColumn::make('available')->label('Disponible')->boolean(),
            TextColumn::make('sortOrder')->label('Ordre')->sortable()->toggleable(isToggledHiddenByDefault: true),
            IconColumn::make('active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                TernaryFilter::make('available')->label('Livraison disponible'),
                TernaryFilter::make('active')->label('Actif'),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListShippingCitys::route('/'),
            'create' => Pages\CreateShippingCity::route('/create'),
            'edit' => Pages\EditShippingCity::route('/{record}/edit'),
        ];
    }
}
