<?php

namespace App\Filament\Resources\TeamInbox\Pages;

use App\Filament\Resources\TeamInbox\TeamInboxResource;
use Filament\Actions\ViewAction;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditTeamInboxMessage extends EditRecord
{
    protected static string $resource = TeamInboxResource::class;

    protected function getHeaderActions(): array
    {
        return [ViewAction::make()->label('Consulter'), DeleteAction::make()];
    }
}
