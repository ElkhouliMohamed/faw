<?php

namespace App\Filament\Resources\SeoSettings;

use App\Filament\Resources\SystemConfigResource;

class SeoSettingsResource extends SystemConfigResource
{
    public static string $configName = 'seo';

    protected static ?string $slug = 'seosettings';

    protected static ?string $navigationLabel = 'Paramètres SEO';

    protected static ?string $modelLabel = 'Paramètres SEO';

    protected static ?string $pluralModelLabel = 'Paramètres SEO';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditSeoSettings::route('/'),
            'edit' => Pages\EditSeoSettings::route('/{record}/edit'),
        ];
    }
}
