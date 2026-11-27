<?php

namespace App\Filament\Resources\CustomerOrders\Pages;

use App\Filament\Pages\OrdersKanban;
use App\Filament\Resources\CustomerOrders\OrderResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ListRecords;

class ListCustomerOrders extends ListRecords
{
    protected static string $resource = OrderResource::class;

    protected ?string $subheading = 'Commandes créées automatiquement quand un client accepte un devis. Le contenu du devis accepté est figé.';

    protected function getHeaderActions(): array
    {
        return [
            Action::make('tableau')->label('Vue tableau')->icon('heroicon-o-view-columns')->color('gray')
                ->visible(fn () => OrdersKanban::canAccess())
                ->url(fn () => OrdersKanban::getUrl(['source' => 'clients'])),
        ];
    }
}
