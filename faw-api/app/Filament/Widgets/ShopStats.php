<?php

namespace App\Filament\Widgets;

use App\Models\Customer;
use App\Models\Product;
use App\Models\Quote;
use App\Models\ShopOrder;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class ShopStats extends StatsOverviewWidget
{
    protected function getStats(): array
    {
        return [
            Stat::make('Devis à valider', Quote::where('status', 'à valider')->count())->color('warning'),
            Stat::make('Commandes / demandes', ShopOrder::count()), Stat::make('Produits', Product::count()), Stat::make('Clients', Customer::count())];
    }
}
