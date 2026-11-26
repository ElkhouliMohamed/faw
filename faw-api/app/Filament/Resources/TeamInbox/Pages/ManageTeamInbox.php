<?php

namespace App\Filament\Resources\TeamInbox\Pages;

use App\Filament\Resources\TeamInbox\TeamInboxResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageTeamInbox extends ManageRecords
{
    protected static string $resource = TeamInboxResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
