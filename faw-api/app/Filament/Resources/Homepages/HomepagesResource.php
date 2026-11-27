<?php

namespace App\Filament\Resources\Homepages;

use App\Filament\Resources\ContentPages\ContentLayout;
use App\Filament\Resources\ContentResource;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

/** The home page is a single record: the list redirects to it once it exists (see ListHomepages). */
class HomepagesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Accueil';

    protected static ?string $modelLabel = 'page d’accueil';

    protected static ?string $pluralModelLabel = 'Accueil';

    protected static ?string $slug = 'homepages';

    public static string $contentKind = 'home';

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
            'index' => Pages\ListHomepages::route('/'),
            'create' => Pages\CreateHomepage::route('/create'),
            'edit' => Pages\EditHomepage::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('home' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
