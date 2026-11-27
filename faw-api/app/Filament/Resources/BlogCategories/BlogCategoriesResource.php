<?php

namespace App\Filament\Resources\BlogCategories;

use App\Filament\Resources\OwnerResource;
use App\Models\BlogCategory;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class BlogCategoriesResource extends OwnerResource
{
    protected static ?string $model = BlogCategory::class;

    protected static ?string $navigationLabel = 'Catégories du blog';

    protected static ?string $modelLabel = 'catégorie du blog';

    protected static ?string $pluralModelLabel = 'Catégories du blog';

    protected static ?string $recordTitleAttribute = 'label';

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    public static function form(Schema $s): Schema
    {
        return $s->components([
            Section::make('Catégorie du blog')
                ->description('Sert à classer les articles du blog. Chaque article peut appartenir à une catégorie.')
                ->schema([
                    TextInput::make('label')->label('Nom')->required()->maxLength(120)
                        ->helperText('Nom affiché aux lecteurs, ex. « Sécurité incendie ».'),
                    TextInput::make('slug')->label('Identifiant URL')->required()->regex('/^[a-z0-9-]+$/')->maxLength(160)->unique(ignoreRecord: true)
                        ->helperText('Minuscules, chiffres et tirets uniquement, ex. securite-incendie.'),
                    Toggle::make('active')->label('Actif')->default(true)
                        ->helperText('Une catégorie inactive n’est plus proposée sur les articles.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $t): Table
    {
        return $t
            ->columns([
                TextColumn::make('label')->label('Nom')->searchable()->sortable(),
                TextColumn::make('slug')->label('URL')->searchable(),
                IconColumn::make('active')->label('Actif')->boolean(),
            ])
            ->filters([TernaryFilter::make('active')->label('Actif')])
            ->defaultSort('label')
            ->recordActions([EditAction::make(), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBlogCategories::route('/'),
            'create' => Pages\CreateBlogCategory::route('/create'),
            'edit' => Pages\EditBlogCategory::route('/{record}/edit'),
        ];
    }
}
