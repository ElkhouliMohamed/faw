<?php

namespace App\Filament\Resources\BlogTags;

use App\Filament\Resources\OwnerResource;
use App\Models\BlogTag;
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

class BlogTagsResource extends OwnerResource
{
    protected static ?string $model = BlogTag::class;

    protected static ?string $navigationLabel = 'Étiquettes du blog';

    protected static ?string $modelLabel = 'étiquette du blog';

    protected static ?string $pluralModelLabel = 'Étiquettes du blog';

    protected static ?string $recordTitleAttribute = 'label';

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    public static function form(Schema $s): Schema
    {
        return $s->components([
            Section::make('Étiquette du blog')
                ->description('Mot-clé libre pour relier des articles entre eux. Un article peut avoir plusieurs étiquettes.')
                ->schema([
                    TextInput::make('label')->label('Nom')->required()->maxLength(120)
                        ->helperText('Nom affiché aux lecteurs, ex. « Portes EI60 ».'),
                    TextInput::make('slug')->label('Identifiant URL')->required()->regex('/^[a-z0-9-]+$/')->maxLength(160)->unique(ignoreRecord: true)
                        ->helperText('Minuscules, chiffres et tirets uniquement, ex. portes-ei60.'),
                    Toggle::make('active')->label('Actif')->default(true)
                        ->helperText('Une étiquette inactive n’est plus proposée sur les articles.'),
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
            'index' => Pages\ListBlogTags::route('/'),
            'create' => Pages\CreateBlogTag::route('/create'),
            'edit' => Pages\EditBlogTag::route('/{record}/edit'),
        ];
    }
}
