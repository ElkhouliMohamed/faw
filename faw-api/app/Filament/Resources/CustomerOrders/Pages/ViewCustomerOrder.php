<?php

namespace App\Filament\Resources\CustomerOrders\Pages;

use App\Filament\Resources\CustomerOrders\OrderResource;
use Filament\Actions\ActionGroup;
use Filament\Resources\Pages\ViewRecord;

class ViewCustomerOrder extends ViewRecord
{
    protected static string $resource = OrderResource::class;

    public function getTitle(): string
    {
        return 'Commande '.$this->getRecord()->reference;
    }

    /** Status, delivery and payment actions: same audited services as before (OrderService, PaymentService). */
    protected function getHeaderActions(): array
    {
        [$status, $delivery] = OrderResource::statusActions();

        return [
            $status,
            $delivery,
            ActionGroup::make(OrderResource::paymentActions())->label('Paiements')->icon('heroicon-o-banknotes')->button()->color('gray'),
        ];
    }
}
