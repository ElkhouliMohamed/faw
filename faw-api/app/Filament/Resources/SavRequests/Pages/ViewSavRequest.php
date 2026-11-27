<?php

namespace App\Filament\Resources\SavRequests\Pages;

use App\Filament\Resources\SavRequests\SavRequestsResource;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewSavRequest extends ViewRecord
{
    protected static string $resource = SavRequestsResource::class;

    protected function getHeaderActions(): array
    {
        return [EditAction::make()->label('Traiter')];
    }
}
