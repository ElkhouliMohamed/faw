<?php

namespace App\Filament\Resources\ShopOrders\Pages;

use App\Filament\Resources\ShopOrders\ShopOrderResource;
use Filament\Actions\EditAction;
use Filament\Resources\Pages\ViewRecord;

class ViewShopOrder extends ViewRecord
{
    protected static string $resource = ShopOrderResource::class;

    public function getTitle(): string
    {
        return 'Commande '.$this->getRecord()->number;
    }

    protected function getHeaderActions(): array
    {
        return [
            ShopOrderResource::changeStatusAction(),
            EditAction::make()->label('Modifier'),
        ];
    }
}
