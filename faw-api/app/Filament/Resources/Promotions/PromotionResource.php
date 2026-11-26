<?php

namespace App\Filament\Resources\Promotions;

use App\Filament\Resources\OwnerResource;
use App\Models\Category;
use App\Models\Product;
use App\Models\Promotion;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class PromotionResource extends OwnerResource
{
    protected static ?string $model = Promotion::class;

    protected static ?string $slug = 'promotions';

    protected static ?string $navigationLabel = 'Promotions';

    protected static ?string $modelLabel = 'Promotions';

    protected static ?string $pluralModelLabel = 'Promotions';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('name')->label('Nom interne')->maxLength(255)->required(), Select::make('kind')->label('Type')->options(['percent' => 'Pourcentage', 'fixed' => 'Montant TTC (DH)'])->default('percent')->live()->required(), TextInput::make('value')->label('Valeur')->maxLength(255)->integer()->minValue(1)->maxValue(fn ($get) => $get('kind') === 'percent' ? 90 : 10000000)->required(), Select::make('scope')->label('Périmètre')->options(['all' => 'Tout le catalogue', 'product' => 'Produits', 'category' => 'Catégories'])->default('all')->live()->required(), Select::make('targets')->label('Cibles')->multiple()->options(fn ($get) => $get('scope') === 'category' ? Category::pluck('label', 'slug')->all() : Product::pluck('title', 'id')->all())->formatStateUsing(fn ($state) => is_string($state) ? array_filter(explode(',', $state)) : ($state ?? []))->dehydrateStateUsing(fn ($state) => implode(',', $state ?? []))->visible(fn ($get) => $get('scope') !== 'all'), DateTimePicker::make('startsAt')->label('Début')->seconds(false), DateTimePicker::make('endsAt')->label('Fin')->seconds(false), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('name')->label('Promotion')->searchable(), TextColumn::make('kind')->label('Type'), TextColumn::make('value')->label('Valeur'), TextColumn::make('scope')->label('Périmètre'), TextColumn::make('endsAt')->label('Fin')->dateTime('d/m/Y H:i')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManagePromotions::route('/')];
    }
}
