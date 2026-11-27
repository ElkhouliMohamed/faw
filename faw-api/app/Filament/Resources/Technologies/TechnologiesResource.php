<?php

namespace App\Filament\Resources\Technologies;

use App\Filament\Resources\ContentPages\ContentLayout;
use App\Filament\Resources\ContentResource;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class TechnologiesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Pages technologies';

    protected static ?string $modelLabel = 'page technologie';

    protected static ?string $pluralModelLabel = 'Pages technologies';

    protected static ?string $recordTitleAttribute = 'title';

    protected static ?string $slug = 'technologies';

    public static string $contentKind = 'technology';

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
            'index' => Pages\ListTechnologies::route('/'),
            'create' => Pages\CreateTechnology::route('/create'),
            'edit' => Pages\EditTechnology::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('technology' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
