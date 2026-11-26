<?php

namespace App\Filament\Resources\ShopSettings;

use App\Filament\Resources\SystemConfigResource;

class ShopSettingsResource extends SystemConfigResource
{
    public static string $configName = 'shop';

    protected static ?string $slug = 'shopsettings';

    protected static ?string $navigationLabel = 'Réglages boutique';

    protected static ?string $modelLabel = 'Réglages boutique';

    protected static ?string $pluralModelLabel = 'Réglages boutique';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageShopSettings::route('/')];
    }
}
