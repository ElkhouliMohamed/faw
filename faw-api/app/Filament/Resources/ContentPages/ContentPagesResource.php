<?php

namespace App\Filament\Resources\ContentPages;

use App\Filament\Resources\ContentResource;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class ContentPagesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Pages & HTML';

    protected static ?string $modelLabel = 'page';

    protected static ?string $pluralModelLabel = 'Pages & HTML';

    protected static ?string $recordTitleAttribute = 'title';

    protected static ?string $slug = 'contentpages';

    public static string $contentKind = 'page';

    public static function form(Schema $schema): Schema
    {
        return ContentLayout::arrange($schema, parent::form(Schema::make())->getComponents(), static::$contentKind);
    }

    public static function table(Table $table): Table
    {
        return ContentLayout::table(parent::table($table));
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListContentPages::route('/'),
            'create' => Pages\CreateContentPage::route('/create'),
            'edit' => Pages\EditContentPage::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('page' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
