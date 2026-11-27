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
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class FeeRuleResource extends OwnerResource
{
    protected static ?string $model = FeeRule::class;

    protected static ?string $slug = 'feerules';

    protected static ?string $navigationLabel = 'Assigner Frais';

    protected static ?string $modelLabel = 'règle de frais';

    protected static ?string $pluralModelLabel = 'Assigner Frais';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Cible de la règle')
                ->description('Choisissez un produit ou une catégorie, puis la ville concernée.')
                ->schema([
                    Select::make('scope')->label('Affectation')->options(['product' => 'Produit', 'category' => 'Catégorie'])->default('product')->live()->required(),
                    Select::make('target')->label('Cible')->options(fn ($get) => $get('scope') === 'category' ? Category::pluck('label', 'slug')->all() : Product::pluck('title', 'id')->all())->searchable()->required()
                        ->helperText('La liste change selon l’affectation choisie.'),
                    Select::make('citySlug')->label('Ville')->options(ShippingCity::pluck('name', 'slug')->all())->placeholder('Toutes les villes')->default('')
                        ->helperText('Laissez « Toutes les villes » pour appliquer la règle partout.'),
                    Toggle::make('active')->label('Actif')->default(false)->inline(false),
                ])->columns($grid),
            Section::make('Calcul des frais')
                ->description('Montant ajouté à la commande pour cette cible.')
                ->schema([
                    Select::make('mode')->label('Calcul')->options(['fixed' => 'Frais fixes TTC', 'devis' => 'Sur devis'])->default('fixed')->required()
                        ->helperText('« Sur devis » : les frais sont chiffrés au cas par cas.'),
                    TextInput::make('fee')->label('Frais TTC (DH)')->maxLength(255)->integer()->minValue(0)->default(0)->required(),
                    Textarea::make('note')->label('Note (sans délai de livraison)')->maxLength(12000)->rows(3)->columnSpanFull(),
                ])->columns($grid),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('scope')->label('Affectation')->formatStateUsing(fn ($state) => $state === 'category' ? 'Catégorie' : 'Produit')->badge(),
            TextColumn::make('target')->label('Cible')->searchable()->sortable(),
            TextColumn::make('citySlug')->label('Ville')->placeholder('Toutes'),
            TextColumn::make('mode')->label('Calcul')->formatStateUsing(fn ($state) => $state === 'devis' ? 'Sur devis' : 'Frais fixes'),
            TextColumn::make('fee')->label('Frais')->suffix(' DH TTC')->sortable(),
            IconColumn::make('active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                SelectFilter::make('scope')->label('Affectation')->options(['product' => 'Produit', 'category' => 'Catégorie']),
                SelectFilter::make('mode')->label('Calcul')->options(['fixed' => 'Frais fixes TTC', 'devis' => 'Sur devis']),
                TernaryFilter::make('active')->label('Actif'),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListFeeRules::route('/'),
            'create' => Pages\CreateFeeRule::route('/create'),
            'edit' => Pages\EditFeeRule::route('/{record}/edit'),
        ];
    }
}
