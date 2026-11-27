<?php

namespace App\Filament\Widgets;

use App\Filament\Widgets\Concerns\ChartPalette;
use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Widgets\ChartWidget;

/** Orders of the period (shop orders and orders from accepted quotes) grouped by where they stand now. */
class OrdersByStatus extends ChartWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected static ?int $sort = 4;

    protected ?string $pollingInterval = null;

    protected ?string $maxHeight = '280px';

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    public function getHeading(): string
    {
        return 'Commandes par statut — '.$this->periodLabel();
    }

    public function getDescription(): string
    {
        return 'Commandes passées sur la période, selon leur statut actuel (hors simples demandes de devis).';
    }

    protected function getType(): string
    {
        return 'doughnut';
    }

    protected function getData(): array
    {
        $period = $this->period();
        $stages = AnalyticsQueries::cached('orders-by-status', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return AnalyticsQueries::ordersByStatus($r['from'], $r['to']);
        });

        return [
            'labels' => array_keys($stages),
            'datasets' => [[
                'label' => 'Commandes',
                'data' => array_values($stages),
                'backgroundColor' => array_map(fn (string $stage) => ChartPalette::STAGES[$stage] ?? ChartPalette::NEUTRAL, array_keys($stages)),
            ]],
        ];
    }

    protected function getOptions(): array
    {
        return ['plugins' => ['legend' => ['position' => 'bottom']], 'scales' => ['x' => ['display' => false], 'y' => ['display' => false]]];
    }
}
