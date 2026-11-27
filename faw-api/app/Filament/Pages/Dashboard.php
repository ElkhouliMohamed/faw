<?php

namespace App\Filament\Pages;

use App\Filament\Widgets\CitySales;
use App\Filament\Widgets\DailySales;
use App\Filament\Widgets\OrdersByStatus;
use App\Filament\Widgets\PendingActions;
use App\Filament\Widgets\ProductSales;
use App\Filament\Widgets\RecentActivity;
use App\Filament\Widgets\ShopStats;
use App\Filament\Widgets\TrafficSources;
use App\Services\AnalyticsQueries;
use Filament\Forms\Components\ToggleButtons;
use Filament\Pages\Dashboard as BaseDashboard;
use Filament\Pages\Dashboard\Concerns\HasFiltersForm;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;

/** Owner dashboard: KPIs of the chosen period, charts and the "À traiter" list. */
class Dashboard extends BaseDashboard
{
    use HasFiltersForm;

    protected static ?string $title = 'Tableau de bord';

    protected static ?string $navigationLabel = 'Tableau de bord';

    protected static string|\BackedEnum|null $navigationIcon = Heroicon::OutlinedHome;

    public function filtersForm(Schema $schema): Schema
    {
        return $schema->columns(1)->components([
            ToggleButtons::make('period')
                ->label('Période')
                ->helperText('Chaque indicateur est comparé à la période précédente de même durée.')
                ->options(AnalyticsQueries::PERIODS)
                ->default(AnalyticsQueries::DEFAULT_PERIOD)
                ->inline()
                ->grouped(),
        ]);
    }

    public function getWidgets(): array
    {
        return [
            ShopStats::class,
            PendingActions::class,
            DailySales::class,
            OrdersByStatus::class,
            ProductSales::class,
            CitySales::class,
            TrafficSources::class,
            RecentActivity::class,
        ];
    }

    public function getColumns(): int|array
    {
        return ['default' => 1, 'lg' => 2];
    }
}
