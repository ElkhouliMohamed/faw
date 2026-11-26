<?php

namespace App\Filament\Resources\ShippingCitys\Pages;

use App\Filament\Resources\ShippingCitys\ShippingCityResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageShippingCitys extends ManageRecords
{
    protected static string $resource = ShippingCityResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
