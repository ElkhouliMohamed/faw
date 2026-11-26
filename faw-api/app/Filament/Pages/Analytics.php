<?php

namespace App\Filament\Pages;

use App\Filament\Widgets\CitySales;
use App\Filament\Widgets\DailySales;
use App\Filament\Widgets\Funnel;
use App\Filament\Widgets\ProductSales;
use App\Filament\Widgets\TrafficSources;
use Filament\Pages\Page;

class Analytics extends Page
{
    public static function canAccess(): bool
    {
        return auth()->user()?->canDo('view.analytics') ?? false;
    }

    protected static ?string $navigationLabel = 'Analytics';

    protected static ?string $title = 'Analytics first-party';

    protected static string|\UnitEnum|null $navigationGroup = 'Aperçu';

    protected string $view = 'filament.pages.analytics';

    protected function getHeaderWidgets(): array
    {
        return [Funnel::class];
    }

    protected function getFooterWidgets(): array
    {
        return [DailySales::class, CitySales::class, ProductSales::class, TrafficSources::class];
    }
}
