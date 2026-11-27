<?php

namespace App\Filament\Resources\TeamInbox\Pages;

use App\Filament\Resources\TeamInbox\TeamInboxResource;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewTeamInboxMessage extends ViewRecord
{
    protected static string $resource = TeamInboxResource::class;

    protected function getHeaderActions(): array
    {
        return [EditAction::make()->label('Traiter')];
    }
}
