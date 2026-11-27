<?php

namespace App\Filament\Resources\Menus;

use App\Filament\Resources\OwnerResource;
use App\Models\SiteMenu;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

/** Header and footer menus of the storefront. A location without an active menu shows the built-in default links. */
class MenuResource extends OwnerResource
{
    protected static ?string $model = SiteMenu::class;

    protected static ?string $slug = 'menus';

    protected static ?string $navigationLabel = 'Menus du site';

    protected static ?string $modelLabel = 'menu';

    protected static ?string $pluralModelLabel = 'Menus du site';

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    protected static ?string $recordTitleAttribute = 'title';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Emplacement')
                ->description('Où le menu s’affiche sur le site. Sans menu actif, le site garde ses liens par défaut.')
                ->schema([
                    Select::make('location')->label('Emplacement')->options(SiteMenu::LOCATIONS)->required()->native(false)->unique(ignoreRecord: true)
                        ->helperText('Un seul menu par emplacement.'),
                    TextInput::make('title')->label('Titre de la colonne')->maxLength(60)->placeholder('Boutique')
                        ->helperText('Affiché au-dessus des liens dans le pied de page (facultatif).'),
                    Toggle::make('active')->label('Menu actif')->default(true)
                        ->helperText('Désactivé : le site affiche les liens par défaut.'),
                ])
                ->columns(['default' => 1, 'lg' => 3])
                ->columnSpanFull(),
            Section::make('Liens')
                ->description('Glissez pour réordonner. Lien interne (/produits), adresse https://, tel:+212… ou mailto:…')
                ->schema([
                    Repeater::make('items')->hiddenLabel()->schema([
                        TextInput::make('label')->label('Libellé')->required()->maxLength(60),
                        TextInput::make('url')->label('Lien')->required()->maxLength(500)->regex(SiteMenu::LINK)->placeholder('/produits'),
                        Toggle::make('newTab')->label('Nouvel onglet')->inline(false),
                        Toggle::make('highlight')->label('Mettre en avant (bouton)')->inline(false)
                            ->helperText('En-tête : affiché comme bouton.'),
                    ])
                        ->columns(['default' => 1, 'md' => 2, 'xl' => 4])
                        ->reorderable()
                        ->collapsible()
                        ->cloneable()
                        ->maxItems(SiteMenu::MAX_ITEMS)
                        ->defaultItems(1)
                        ->itemLabel(fn (array $state): ?string => filled($state['label'] ?? null) ? $state['label'].'  →  '.($state['url'] ?? '') : null)
                        ->addActionLabel('Ajouter un lien'),
                ])
                ->columnSpanFull(),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('location')->label('Emplacement')->formatStateUsing(fn (string $state) => SiteMenu::LOCATIONS[$state] ?? $state)->sortable(),
                TextColumn::make('title')->label('Titre')->placeholder('—'),
                TextColumn::make('items')->label('Liens')->state(fn (SiteMenu $record) => count($record->items ?? []).' lien(s)'),
                IconColumn::make('active')->label('Actif')->boolean(),
                TextColumn::make('updatedAt')->label('Modifié')->dateTime('d/m/Y H:i')->placeholder('—'),
            ])
            ->defaultSort('location')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListMenus::route('/'),
            'create' => Pages\CreateMenu::route('/create'),
            'edit' => Pages\EditMenu::route('/{record}/edit'),
        ];
    }
}
