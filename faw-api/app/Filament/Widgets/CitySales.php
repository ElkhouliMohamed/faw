<?php

namespace App\Filament\Widgets;

use App\Filament\Widgets\Concerns\ChartPalette;
use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Widgets\ChartWidget;

/** Cities ranked by revenue, then by number of requests. */
class CitySales extends ChartWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected static ?int $sort = 6;

    protected ?string $pollingInterval = null;

    protected ?string $maxHeight = '320px';

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    public function getHeading(): string
    {
        return 'Top villes — '.$this->periodLabel();
    }

    public function getDescription(): string
    {
        return 'Chiffre d’affaires confirmé (MAD TTC) par ville ; nombre de demandes reçues entre parenthèses.';
    }

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getData(): array
    {
        $period = $this->period();
        $rows = AnalyticsQueries::cached('top-cities', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return AnalyticsQueries::topCities($r['from'], $r['to']);
        });

        return [
            'labels' => array_map(fn (array $c) => $c['city'].' ('.$c['requests'].')', $rows),
            'datasets' => [['label' => 'Chiffre d’affaires (MAD)', 'data' => array_column($rows, 'sales'), 'backgroundColor' => ChartPalette::BRAND]],
        ];
    }

    protected function getOptions(): array
    {
        return ['indexAxis' => 'y', 'plugins' => ['legend' => ['display' => false]], 'scales' => ['x' => ['beginAtZero' => true]]];
    }
}
