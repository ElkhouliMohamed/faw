<?php

namespace App\Filament\Resources\Bundles;

use App\Filament\Resources\OwnerResource;
use App\Models\Bundle;
use App\Models\Product;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class BundleResource extends OwnerResource
{
    protected static ?string $model = Bundle::class;

    protected static ?string $slug = 'bundles';

    protected static ?string $navigationLabel = 'Packs';

    protected static ?string $modelLabel = 'pack';

    protected static ?string $pluralModelLabel = 'Packs';

    protected static ?string $recordTitleAttribute = 'title';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Pack')
                ->description('Un pack regroupe plusieurs produits vendus ensemble à un prix global.')
                ->schema([
                    TextInput::make('title')->label('Nom du pack')->maxLength(255)->required()
                        ->helperText('Nom affiché aux clients.'),
                    TextInput::make('slug')->label('URL')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true)
                        ->helperText('Minuscules, chiffres et tirets uniquement, ex. pack-porte-ei60.'),
                    Textarea::make('description')->label('Description')->maxLength(12000)->rows(5)->columnSpanFull(),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Section::make('Composition')
                ->description('Produits inclus dans le pack et quantité de chacun (1 à 20 lignes).')
                ->schema([
                    Repeater::make('items')->label('Composition')->schema([
                        Select::make('id')->label('Produit')->options(Product::pluck('title', 'id')->all())->searchable()->required(),
                        TextInput::make('qty')->label('Quantité')->integer()->minValue(1)->maxValue(99)->default(1)->dehydrateStateUsing(fn ($state) => (int) $state)->required(),
                    ])->minItems(1)->maxItems(20)->columns(2)->columnSpanFull()->required()->addActionLabel('Ajouter un produit'),
                ])
                ->columnSpanFull(),
            Section::make('Prix & publication')
                ->schema([
                    TextInput::make('price')->label('Prix pack TTC (DH)')->maxLength(255)->integer()->minValue(0)->default(1)->required()
                        ->helperText('Prix total du pack, toutes taxes comprises.'),
                    TextInput::make('image')->label('Photo (chemin local)')->maxLength(255)->regex('#^/(?:images|storage)/[a-zA-Z0-9/_.-]+$#')
                        ->helperText('Chemin d’une image de la médiathèque, ex. /storage/media/pack.webp.'),
                    TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required()
                        ->helperText('Les plus petits numéros apparaissent en premier.'),
                    Toggle::make('active')->label('Actif')->default(false)
                        ->helperText('Un pack inactif n’est pas visible sur le site.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Section::make('Référencement (SEO)')
                ->description('Titre et description proposés à Google pour la page du pack.')
                ->schema([
                    TextInput::make('seoTitle')->label('Titre SEO')->maxLength(255)->columnSpanFull(),
                    Textarea::make('seoDescription')->label('Description SEO')->maxLength(12000)->columnSpanFull(),
                ])
                ->collapsible()
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')->label('Pack')->searchable()->sortable(),
                TextColumn::make('slug')->label('URL')->searchable()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('price')->label('Prix')->suffix(' DH TTC')->sortable(),
                IconColumn::make('active')->label('Actif')->boolean(),
            ])
            ->filters([TernaryFilter::make('active')->label('Actif')])
            ->defaultSort('id', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBundles::route('/'),
            'create' => Pages\CreateBundle::route('/create'),
            'edit' => Pages\EditBundle::route('/{record}/edit'),
        ];
    }
}
