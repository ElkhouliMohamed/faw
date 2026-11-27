<?php

namespace App\Filament\Resources\Socials;

use App\Filament\Resources\SystemConfigResource;

class SocialsResource extends SystemConfigResource
{
    public static string $configName = 'social';

    protected static ?string $slug = 'socials';

    protected static ?string $navigationLabel = 'Réseaux sociaux';

    protected static ?string $modelLabel = 'Réseaux sociaux';

    protected static ?string $pluralModelLabel = 'Réseaux sociaux';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditSocials::route('/'),
            'edit' => Pages\EditSocials::route('/{record}/edit'),
        ];
    }
}
