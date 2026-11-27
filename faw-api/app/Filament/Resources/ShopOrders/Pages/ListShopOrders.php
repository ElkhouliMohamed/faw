<?php

namespace App\Filament\Resources\ShopOrders\Pages;

use App\Filament\Pages\OrdersKanban;
use App\Filament\Resources\ShopOrders\ShopOrderResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ListRecords;

class ListShopOrders extends ListRecords
{
    protected static string $resource = ShopOrderResource::class;

    protected ?string $subheading = 'Commandes et demandes passées sur le site. Ouvrez une ligne pour voir le détail ou changer le statut.';

    protected function getHeaderActions(): array
    {
        return [
            Action::make('tableau')->label('Vue tableau')->icon('heroicon-o-view-columns')->color('gray')
                ->visible(fn () => OrdersKanban::canAccess())
                ->url(fn () => OrdersKanban::getUrl()),
        ];
    }
}
