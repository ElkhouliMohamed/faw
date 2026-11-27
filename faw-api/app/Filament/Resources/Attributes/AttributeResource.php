<?php

namespace App\Filament\Resources\Attributes;

use App\Filament\Resources\OwnerResource;
use App\Models\Attribute;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
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

class AttributeResource extends OwnerResource
{
    protected static ?string $model = Attribute::class;

    protected static ?string $slug = 'attributes';

    protected static ?string $navigationLabel = 'Attributs';

    protected static ?string $modelLabel = 'attribut';

    protected static ?string $pluralModelLabel = 'Attributs';

    protected static ?string $recordTitleAttribute = 'label';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public const KINDS = ['text' => 'Texte', 'number' => 'Nombre', 'select' => 'Choix'];

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Attribut')
                ->description('Une caractéristique technique réutilisable sur les fiches produits (largeur, résistance au feu, finition…).')
                ->schema([
                    TextInput::make('label')->label('Libellé')->maxLength(255)->required()
                        ->helperText('Nom affiché aux clients, ex. « Largeur ».'),
                    TextInput::make('key')->label('Clé réutilisable')->maxLength(255)->required()->regex('/^[a-z][a-z0-9_]*$/')->unique(ignoreRecord: true)
                        ->helperText('Minuscules, chiffres et « _ » uniquement, ex. largeur_cm. Sert à saisir la valeur sur chaque produit.'),
                    Select::make('kind')->label('Type')->options(self::KINDS)->default('text')->required()
                        ->helperText('Texte libre, nombre ou liste de choix.'),
                    TextInput::make('unit')->label('Unité')->maxLength(255)
                        ->helperText('Facultatif, ex. cm, mm, min.'),
                    TextInput::make('options')->label('Choix (séparés par une virgule)')->maxLength(255)
                        ->helperText('Uniquement pour le type « Choix », ex. EI30, EI60, EI90.')
                        ->columnSpanFull(),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Section::make('Affichage')
                ->description('Ordre et visibilité de l’attribut sur le site.')
                ->schema([
                    TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required()
                        ->helperText('Les plus petits numéros apparaissent en premier.'),
                    Toggle::make('showInSpecs')->label('Afficher dans les caractéristiques')->default(true)
                        ->helperText('Visible dans le tableau des caractéristiques de la fiche produit.'),
                    Toggle::make('active')->label('Actif')->default(false)
                        ->helperText('Un attribut inactif n’est plus proposé ni affiché.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('key')->label('Clé')->searchable()->sortable(),
                TextColumn::make('label')->label('Libellé')->searchable()->sortable(),
                TextColumn::make('kind')->label('Type')->formatStateUsing(fn ($state) => self::KINDS[$state] ?? $state),
                TextColumn::make('unit')->label('Unité'),
                TextColumn::make('sortOrder')->label('Ordre')->sortable(),
                IconColumn::make('active')->label('Actif')->boolean(),
            ])
            ->filters([
                SelectFilter::make('kind')->label('Type')->options(self::KINDS),
                TernaryFilter::make('active')->label('Actif'),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListAttributes::route('/'),
            'create' => Pages\CreateAttribute::route('/create'),
            'edit' => Pages\EditAttribute::route('/{record}/edit'),
        ];
    }
}
