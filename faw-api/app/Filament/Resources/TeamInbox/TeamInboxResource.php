<?php

namespace App\Filament\Resources\TeamInbox;

use App\Filament\Resources\InboxResource;

class TeamInboxResource extends InboxResource
{
    protected static ?string $slug = 'team-inbox';

    protected static ?string $navigationLabel = 'Boîte équipe';

    protected static ?string $modelLabel = 'Boîte équipe';

    protected static ?string $pluralModelLabel = 'Boîte équipe';

    public static ?string $messageKind = null;

    public static function getPages(): array
    {
        return ['index' => Pages\ManageTeamInbox::route('/')];
    }
}
