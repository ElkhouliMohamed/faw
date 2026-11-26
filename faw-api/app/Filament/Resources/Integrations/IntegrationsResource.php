<?php

namespace App\Filament\Resources\Integrations;

use App\Filament\Resources\SystemConfigResource;

class IntegrationsResource extends SystemConfigResource
{
    public static string $configName = 'integrations';

    protected static ?string $slug = 'integrations';

    protected static ?string $navigationLabel = 'Intégrations marketing';

    protected static ?string $modelLabel = 'Intégrations marketing';

    protected static ?string $pluralModelLabel = 'Intégrations marketing';

    protected static string|\UnitEnum|null $navigationGroup = 'Système';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageIntegrations::route('/')];
    }
}
