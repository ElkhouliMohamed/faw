<?php

namespace App\Filament\Resources\TeamInbox;

use App\Filament\Resources\InboxResource;

class TeamInboxResource extends InboxResource
{
    protected static ?string $slug = 'team-inbox';

    protected static ?string $navigationLabel = 'Boîte équipe';

    protected static ?string $modelLabel = 'message';

    protected static ?string $pluralModelLabel = 'Boîte équipe';

    public static ?string $messageKind = null;

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTeamInbox::route('/'),
            'create' => Pages\CreateTeamInboxMessage::route('/create'),
            'view' => Pages\ViewTeamInboxMessage::route('/{record}'),
            'edit' => Pages\EditTeamInboxMessage::route('/{record}/edit'),
        ];
    }
}
