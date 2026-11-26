<?php

namespace App\Filament\Resources\Cmi;

use App\Filament\Resources\SystemConfigResource;

class CmiResource extends SystemConfigResource
{
    public static string $configName = 'cmi';

    protected static ?string $slug = 'cmi';

    protected static ?string $navigationLabel = 'Paiement CMI — désactivé';

    protected static ?string $modelLabel = 'Paiement CMI — désactivé';

    protected static ?string $pluralModelLabel = 'Paiement CMI — désactivé';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageCmi::route('/')];
    }
}
