<?php

namespace App\Filament\Resources\Aramex;

use App\Filament\Resources\SystemConfigResource;

class AramexResource extends SystemConfigResource
{
    public static string $configName = 'aramex';

    protected static ?string $slug = 'aramex';

    protected static ?string $navigationLabel = 'Aramex';

    protected static ?string $modelLabel = 'Aramex';

    protected static ?string $pluralModelLabel = 'Aramex';

    protected static string|\UnitEnum|null $navigationGroup = 'Système';

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditAramex::route('/'),
            'edit' => Pages\EditAramex::route('/{record}/edit'),
        ];
    }
}
