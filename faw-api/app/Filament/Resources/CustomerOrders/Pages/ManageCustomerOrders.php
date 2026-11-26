<?php

namespace App\Filament\Resources\CustomerOrders\Pages;

use App\Filament\Resources\CustomerOrders\OrderResource;
use Filament\Resources\Pages\ManageRecords;

class ManageCustomerOrders extends ManageRecords
{
    protected static string $resource = OrderResource::class;

    protected function getHeaderActions(): array
    {
        return [];
    }
}
