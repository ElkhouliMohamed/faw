<?php

namespace App\Filament\Resources\Attributes;

use App\Filament\Resources\OwnerResource;
use App\Models\Attribute;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class AttributeResource extends OwnerResource
{
    protected static ?string $model = Attribute::class;

    protected static ?string $slug = 'attributes';

    protected static ?string $navigationLabel = 'Attributs';

    protected static ?string $modelLabel = 'Attributs';

    protected static ?string $pluralModelLabel = 'Attributs';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('key')->label('Clé réutilisable')->maxLength(255)->required()->regex('/^[a-z][a-z0-9_]*$/')->unique(ignoreRecord: true), TextInput::make('label')->label('Libellé')->maxLength(255)->required(), TextInput::make('unit')->label('Unité')->maxLength(255), Select::make('kind')->label('Type')->options(['text' => 'Texte', 'number' => 'Nombre', 'select' => 'Choix'])->default('text')->required(), TextInput::make('options')->label('Choix (séparés par une virgule)')->maxLength(255), TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required(), Toggle::make('showInSpecs')->label('Afficher dans les caractéristiques')->default(true), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('key')->label('Clé'), TextColumn::make('label')->label('Libellé')->searchable(), TextColumn::make('unit')->label('Unité')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageAttributes::route('/')];
    }
}
