<?php

namespace App\Filament\Resources\SavRequests\Pages;

use App\Filament\Resources\SavRequests\SavRequestsResource;
use Filament\Actions\ViewAction;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditSavRequest extends EditRecord
{
    protected static string $resource = SavRequestsResource::class;

    protected function getHeaderActions(): array
    {
        return [ViewAction::make()->label('Consulter'), DeleteAction::make()];
    }
}
