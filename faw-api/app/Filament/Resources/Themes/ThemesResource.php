<?php

namespace App\Filament\Resources\Themes;

use App\Filament\Resources\SystemConfigResource;

class ThemesResource extends SystemConfigResource
{
    public static string $configName = 'theme';

    protected static ?string $slug = 'themes';

    protected static ?string $navigationLabel = 'Thèmes';

    protected static ?string $modelLabel = 'Thèmes';

    protected static ?string $pluralModelLabel = 'Thèmes';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageThemes::route('/')];
    }
}
