<?php

namespace App\Filament\Resources\Dynamics;

use App\Filament\Resources\SystemConfigResource;

class DynamicsResource extends SystemConfigResource
{
    public static string $configName = 'dynamics';

    protected static ?string $slug = 'dynamics';

    protected static ?string $navigationLabel = 'Dynamics';

    protected static ?string $modelLabel = 'Dynamics';

    protected static ?string $pluralModelLabel = 'Dynamics';

    protected static string|\UnitEnum|null $navigationGroup = 'Système';

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditDynamics::route('/'),
            'edit' => Pages\EditDynamics::route('/{record}/edit'),
        ];
    }
}
