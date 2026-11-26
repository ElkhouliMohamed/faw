<?php

namespace App\Filament\Resources\Technologies;

use App\Filament\Resources\ContentResource;

class TechnologiesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Pages technologies';

    protected static ?string $modelLabel = 'Pages technologies';

    protected static ?string $pluralModelLabel = 'Pages technologies';

    protected static ?string $slug = 'technologies';

    public static string $contentKind = 'technology';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageTechnologies::route('/')];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('technology' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
