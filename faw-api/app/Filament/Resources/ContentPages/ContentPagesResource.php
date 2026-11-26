<?php

namespace App\Filament\Resources\ContentPages;

use App\Filament\Resources\ContentResource;

class ContentPagesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Pages & HTML';

    protected static ?string $modelLabel = 'Pages & HTML';

    protected static ?string $pluralModelLabel = 'Pages & HTML';

    protected static ?string $slug = 'contentpages';

    public static string $contentKind = 'page';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageContentPages::route('/')];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('page' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
