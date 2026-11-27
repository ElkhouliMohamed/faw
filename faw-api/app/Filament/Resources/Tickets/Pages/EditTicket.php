<?php

namespace App\Filament\Resources\Tickets\Pages;

use App\Filament\Resources\Tickets\TicketsResource;
use Filament\Actions\ViewAction;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditTicket extends EditRecord
{
    protected static string $resource = TicketsResource::class;

    protected function getHeaderActions(): array
    {
        return [ViewAction::make()->label('Consulter'), DeleteAction::make()];
    }
}
