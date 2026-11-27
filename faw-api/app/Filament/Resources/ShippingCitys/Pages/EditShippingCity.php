<?php

namespace App\Filament\Resources\ShippingCitys\Pages;

use App\Filament\Resources\ShippingCitys\ShippingCityResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditShippingCity extends EditRecord
{
    protected static string $resource = ShippingCityResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
