<?php

namespace App\Filament\Resources\ShippingCitys\Pages;

use App\Filament\Resources\ShippingCitys\ShippingCityResource;
use Filament\Resources\Pages\CreateRecord;

class CreateShippingCity extends CreateRecord
{
    protected static string $resource = ShippingCityResource::class;

    protected function getRedirectUrl(): string
    {
        return static::getResource()::getUrl('index');
    }
}
