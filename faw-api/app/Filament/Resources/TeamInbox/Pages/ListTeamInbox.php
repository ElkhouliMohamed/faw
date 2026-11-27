<?php

namespace App\Filament\Resources\TeamInbox\Pages;

use App\Filament\Resources\TeamInbox\TeamInboxResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListTeamInbox extends ListRecords
{
    protected static string $resource = TeamInboxResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()->label('Nouveau')];
    }
}
