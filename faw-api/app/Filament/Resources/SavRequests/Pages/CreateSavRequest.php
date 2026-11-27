<?php

namespace App\Filament\Resources\SavRequests\Pages;

use App\Filament\Resources\SavRequests\SavRequestsResource;
use Filament\Resources\Pages\CreateRecord;

class CreateSavRequest extends CreateRecord
{
    protected static string $resource = SavRequestsResource::class;

    protected function getRedirectUrl(): string
    {
        return static::getResource()::getUrl('index');
    }
}
