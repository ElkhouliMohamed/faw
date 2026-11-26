<?php

namespace App\Filament\Resources\Homepages;

use App\Filament\Resources\ContentResource;

class HomepagesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Accueil';

    protected static ?string $modelLabel = 'Accueil';

    protected static ?string $pluralModelLabel = 'Accueil';

    protected static ?string $slug = 'homepages';

    public static string $contentKind = 'home';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageHomepages::route('/')];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('home' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
