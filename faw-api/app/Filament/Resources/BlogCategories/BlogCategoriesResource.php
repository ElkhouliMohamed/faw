<?php

namespace App\Filament\Resources\BlogCategories;

use App\Filament\Resources\OwnerResource;
use App\Models\BlogCategory;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class BlogCategoriesResource extends OwnerResource
{
    protected static ?string $model = BlogCategory::class;

    protected static ?string $navigationLabel = 'Catégories du blog';

    protected static ?string $modelLabel = 'Catégories du blog';

    protected static ?string $pluralModelLabel = 'Catégories du blog';

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    public static function form(Schema $s): Schema
    {
        return $s->components([TextInput::make('label')->label('Nom')->required()->maxLength(120), TextInput::make('slug')->label('Identifiant URL')->required()->regex('/^[a-z0-9-]+$/')->maxLength(160)->unique(ignoreRecord: true), Toggle::make('active')->label('Actif')->default(true)]);
    }

    public static function table(Table $t): Table
    {
        return $t->columns([TextColumn::make('label')->label('Nom')->searchable(), TextColumn::make('slug')->label('URL'), IconColumn::make('active')->label('Actif')->boolean()])->recordActions([EditAction::make(), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageBlogCategories::route('/')];
    }
}
