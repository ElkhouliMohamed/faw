<?php

namespace App\Filament\Widgets;

use App\Filament\Widgets\Concerns\ChartPalette;
use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Widgets\ChartWidget;

/** First-party traffic sources (UTM source · campaign): page views, quote requests and orders. */
class TrafficSources extends ChartWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected static ?int $sort = 7;

    protected ?string $pollingInterval = null;

    protected ?string $maxHeight = '320px';

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    public function getHeading(): string
    {
        return 'Sources de trafic — '.$this->periodLabel();
    }

    public function getDescription(): string
    {
        return 'Mesure du site (sans Google) : « direct » = aucune source UTM. Les vues sont des pages vues, pas des visiteurs uniques.';
    }

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getData(): array
    {
        $period = $this->period();
        $rows = AnalyticsQueries::cached('traffic-sources', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return AnalyticsQueries::trafficSources($r['from'], $r['to']);
        });

        return [
            'labels' => array_map(fn (array $s) => mb_strimwidth($s['source'], 0, 40, '…'), $rows),
            'datasets' => [
                ['label' => 'Vues', 'data' => array_column($rows, 'views'), 'backgroundColor' => ChartPalette::NEUTRAL_SOFT, 'borderColor' => ChartPalette::NEUTRAL, 'borderWidth' => 1, 'xAxisID' => 'x'],
                ['label' => 'Demandes de devis', 'data' => array_column($rows, 'quotes'), 'backgroundColor' => ChartPalette::DARK, 'xAxisID' => 'x1'],
                ['label' => 'Commandes', 'data' => array_column($rows, 'orders'), 'backgroundColor' => ChartPalette::BRAND, 'xAxisID' => 'x1'],
            ],
        ];
    }

    protected function getOptions(): array
    {
        return [
            'indexAxis' => 'y',
            'plugins' => ['legend' => ['position' => 'bottom']],
            'scales' => [
                'x' => ['beginAtZero' => true, 'position' => 'bottom', 'ticks' => ['precision' => 0], 'title' => ['display' => true, 'text' => 'Vues']],
                'x1' => ['beginAtZero' => true, 'position' => 'top', 'grid' => ['drawOnChartArea' => false], 'ticks' => ['precision' => 0], 'title' => ['display' => true, 'text' => 'Devis / commandes']],
            ],
        ];
    }
}
