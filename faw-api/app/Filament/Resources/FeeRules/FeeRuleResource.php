<?php

namespace App\Filament\Resources\FeeRules;

use App\Filament\Resources\OwnerResource;
use App\Models\Category;
use App\Models\FeeRule;
use App\Models\Product;
use App\Models\ShippingCity;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class FeeRuleResource extends OwnerResource
{
    protected static ?string $model = FeeRule::class;

    protected static ?string $slug = 'feerules';

    protected static ?string $navigationLabel = 'Assigner Frais';

    protected static ?string $modelLabel = 'Assigner Frais';

    protected static ?string $pluralModelLabel = 'Assigner Frais';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([Select::make('scope')->label('Affectation')->options(['product' => 'Produit', 'category' => 'Catégorie'])->default('product')->live()->required(), Select::make('target')->label('Cible')->options(fn ($get) => $get('scope') === 'category' ? Category::pluck('label', 'slug')->all() : Product::pluck('title', 'id')->all())->searchable()->required(), Select::make('citySlug')->label('Ville')->options(ShippingCity::pluck('name', 'slug')->all())->placeholder('Toutes les villes')->default(''), Select::make('mode')->label('Calcul')->options(['fixed' => 'Frais fixes TTC', 'devis' => 'Sur devis'])->default('fixed')->required(), TextInput::make('fee')->label('Frais TTC (DH)')->maxLength(255)->integer()->minValue(0)->default(0)->required(), Textarea::make('note')->label('Note (sans délai de livraison)')->maxLength(12000)->columnSpanFull(), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('scope')->label('Affectation'), TextColumn::make('target')->label('Cible')->searchable(), TextColumn::make('citySlug')->label('Ville')->placeholder('Toutes'), TextColumn::make('mode')->label('Calcul'), TextColumn::make('fee')->label('Frais')->suffix(' DH TTC')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageFeeRules::route('/')];
    }
}
