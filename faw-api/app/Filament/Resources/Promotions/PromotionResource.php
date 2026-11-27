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
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class PromotionResource extends OwnerResource
{
    protected static ?string $model = Promotion::class;

    protected static ?string $slug = 'promotions';

    protected static ?string $navigationLabel = 'Promotions';

    protected static ?string $modelLabel = 'promotion';

    protected static ?string $pluralModelLabel = 'Promotions';

    protected static ?string $recordTitleAttribute = 'name';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Remise')
                ->description('Réduction appliquée automatiquement aux prix affichés, sans code.')
                ->schema([
                    TextInput::make('name')->label('Nom interne')->maxLength(255)->required()
                        ->helperText('Visible uniquement dans le back-office (ex. : Soldes été portes coupe-feu).'),
                    Toggle::make('active')->label('Actif')->default(false)->inline(false),
                    Select::make('kind')->label('Type')->options(['percent' => 'Pourcentage', 'fixed' => 'Montant TTC (DH)'])->default('percent')->live()->required(),
                    TextInput::make('value')->label('Valeur')->maxLength(255)->integer()->minValue(1)->maxValue(fn ($get) => $get('kind') === 'percent' ? 90 : 10000000)->required()
                        ->helperText(fn ($get) => $get('kind') === 'percent' ? 'Pourcentage de remise (90 % maximum).' : 'Montant de la remise en dirhams TTC.'),
                ])->columns($grid),
            Section::make('Périmètre')
                ->description('Produits ou catégories concernés par la promotion.')
                ->schema([
                    Select::make('scope')->label('Périmètre')->options(['all' => 'Tout le catalogue', 'product' => 'Produits', 'category' => 'Catégories'])->default('all')->live()->required(),
                    Select::make('targets')->label('Cibles')->multiple()->options(fn ($get) => $get('scope') === 'category' ? Category::pluck('label', 'slug')->all() : Product::pluck('title', 'id')->all())->formatStateUsing(fn ($state) => is_string($state) ? array_filter(explode(',', $state)) : ($state ?? []))->dehydrateStateUsing(fn ($state) => implode(',', $state ?? []))->visible(fn ($get) => $get('scope') !== 'all')
                        ->helperText('Sélectionnez un ou plusieurs éléments.'),
                ])->columns($grid),
            Section::make('Période')
                ->description('Laissez vide pour une promotion sans date de début ou de fin.')
                ->schema([
                    DateTimePicker::make('startsAt')->label('Début')->seconds(false),
                    DateTimePicker::make('endsAt')->label('Fin')->seconds(false),
                ])->columns($grid),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->label('Promotion')->searchable()->sortable()->weight('bold'),
            TextColumn::make('kind')->label('Type')->formatStateUsing(fn ($state) => $state === 'fixed' ? 'Montant' : 'Pourcentage'),
            TextColumn::make('value')->label('Valeur')->sortable(),
            TextColumn::make('scope')->label('Périmètre')->formatStateUsing(fn ($state) => ['all' => 'Tout le catalogue', 'product' => 'Produits', 'category' => 'Catégories'][$state] ?? $state),
            TextColumn::make('endsAt')->label('Fin')->dateTime('d/m/Y H:i')->sortable()->placeholder('—'),
            IconColumn::make('active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                TernaryFilter::make('active')->label('Actif'),
                SelectFilter::make('scope')->label('Périmètre')->options(['all' => 'Tout le catalogue', 'product' => 'Produits', 'category' => 'Catégories']),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListPromotions::route('/'),
            'create' => Pages\CreatePromotion::route('/create'),
            'edit' => Pages\EditPromotion::route('/{record}/edit'),
        ];
    }
}
