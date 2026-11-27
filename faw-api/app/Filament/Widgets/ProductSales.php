<?php

namespace App\Filament\Widgets;

use App\Filament\Widgets\Concerns\ChartPalette;
use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Widgets\ChartWidget;

/** Most requested products: units requested vs units actually sold. */
class ProductSales extends ChartWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected static ?int $sort = 5;

    protected ?string $pollingInterval = null;

    protected ?string $maxHeight = '320px';

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    public function getHeading(): string
    {
        return 'Top produits — '.$this->periodLabel();
    }

    public function getDescription(): string
    {
        return 'Unités demandées (commandes et devis) et unités vendues. Entre parenthèses : chiffre d’affaires hors transport.';
    }

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getData(): array
    {
        $period = $this->period();
        $rows = AnalyticsQueries::cached('top-products', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return AnalyticsQueries::topProducts($r['from'], $r['to']);
        });

        return [
            'labels' => array_map(fn (array $p) => mb_strimwidth($p['title'] ?: $p['productId'], 0, 40, '…').($p['sales'] > 0 ? ' ('.static::money($p['sales']).')' : ''), $rows),
            'datasets' => [
                ['label' => 'Unités demandées', 'data' => array_column($rows, 'requested'), 'backgroundColor' => ChartPalette::NEUTRAL_SOFT, 'borderColor' => ChartPalette::NEUTRAL, 'borderWidth' => 1],
                ['label' => 'Unités vendues', 'data' => array_column($rows, 'sold'), 'backgroundColor' => ChartPalette::BRAND, 'borderColor' => ChartPalette::BRAND],
            ],
        ];
    }

    protected function getOptions(): array
    {
        return ['indexAxis' => 'y', 'plugins' => ['legend' => ['position' => 'bottom']], 'scales' => ['x' => ['beginAtZero' => true, 'ticks' => ['precision' => 0]]]];
    }
}
