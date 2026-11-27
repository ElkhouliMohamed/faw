<?php

namespace App\Filament\Resources\SavRequests\Pages;

use App\Filament\Resources\SavRequests\SavRequestsResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListSavRequests extends ListRecords
{
    protected static string $resource = SavRequestsResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()->label('Nouveau')];
    }
}
