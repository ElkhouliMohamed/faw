<?php

namespace App\Filament\Resources\TeamInbox\Pages;

use App\Filament\Resources\TeamInbox\TeamInboxResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTeamInboxMessage extends CreateRecord
{
    protected static string $resource = TeamInboxResource::class;

    protected function getRedirectUrl(): string
    {
        return static::getResource()::getUrl('index');
    }
}
