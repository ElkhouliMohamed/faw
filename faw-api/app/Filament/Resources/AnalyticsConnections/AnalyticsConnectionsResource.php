<?php

namespace App\Filament\Resources\AnalyticsConnections;

use App\Filament\Resources\SystemConfigResource;

class AnalyticsConnectionsResource extends SystemConfigResource
{
    public static string $configName = 'analytics_api';

    protected static ?string $slug = 'analyticsconnections';

    protected static ?string $navigationLabel = 'API Analytics & GSC';

    protected static ?string $modelLabel = 'API Analytics & GSC';

    protected static ?string $pluralModelLabel = 'API Analytics & GSC';

    protected static string|\UnitEnum|null $navigationGroup = 'Système';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageAnalyticsConnections::route('/')];
    }
}
