<?php

namespace App\Filament\Resources\Notifications;

use App\Filament\Resources\SystemConfigResource;

class NotificationsResource extends SystemConfigResource
{
    public static string $configName = 'notifications';

    protected static ?string $slug = 'notifications';

    protected static ?string $navigationLabel = 'Notifications & SMTP / Resend';

    protected static ?string $modelLabel = 'Notifications & SMTP / Resend';

    protected static ?string $pluralModelLabel = 'Notifications & SMTP / Resend';

    protected static string|\UnitEnum|null $navigationGroup = 'Communication';

    /** Singleton: /admin/notifications opens the configuration row directly (no list). */
    public static function getPages(): array
    {
        return [
            'index' => Pages\EditNotifications::route('/'),
            'edit' => Pages\EditNotifications::route('/{record}/edit'),
        ];
    }
}
