<?php

namespace App\Filament\Resources\Badges;

use App\Filament\Resources\OwnerResource;
use App\Models\Badge;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class BadgeResource extends OwnerResource
{
    protected static ?string $model = Badge::class;

    protected static ?string $slug = 'badges';

    protected static ?string $navigationLabel = 'Badges';

    protected static ?string $modelLabel = 'badge';

    protected static ?string $pluralModelLabel = 'Badges';

    protected static ?string $recordTitleAttribute = 'label';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public const TONES = ['neutral' => 'Neutre', 'copper' => 'Cuivre', 'green' => 'Vert doux'];

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Badge')
                ->description('Petite étiquette affichée sur les cartes produits, ex. « Nouveau » ou « Best-seller ». À assigner ensuite depuis la fiche produit.')
                ->schema([
                    TextInput::make('label')->label('Libellé')->maxLength(255)->required()
                        ->helperText('Texte court, 1 à 3 mots.'),
                    Select::make('tone')->label('Style')->options(self::TONES)->default('neutral')->required()
                        ->helperText('Couleur du badge sur le site.'),
                    TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required()
                        ->helperText('Les plus petits numéros apparaissent en premier.'),
                    Toggle::make('active')->label('Actif')->default(false)
                        ->helperText('Un badge inactif n’est plus affiché ni proposé.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('label')->label('Badge')->searchable()->sortable(),
                TextColumn::make('tone')->label('Style')->formatStateUsing(fn ($state) => self::TONES[$state] ?? $state),
                TextColumn::make('sortOrder')->label('Ordre')->sortable(),
                IconColumn::make('active')->label('Actif')->boolean(),
            ])
            ->filters([TernaryFilter::make('active')->label('Actif')])
            ->defaultSort('id', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBadges::route('/'),
            'create' => Pages\CreateBadge::route('/create'),
            'edit' => Pages\EditBadge::route('/{record}/edit'),
        ];
    }
}
