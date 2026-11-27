<?php

namespace App\Filament\Widgets;

use App\Filament\Widgets\Concerns\ChartPalette;
use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Support\RawJs;
use Filament\Widgets\ChartWidget;

/** Chiffre d'affaires per day (per month on 12 months) with the number of requests received. */
class DailySales extends ChartWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected static ?int $sort = 3;

    protected int|string|array $columnSpan = 'full';

    protected ?string $pollingInterval = null;

    protected ?string $maxHeight = '320px';

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    public function getHeading(): string
    {
        return 'Chiffre d’affaires — '.$this->periodLabel();
    }

    public function getDescription(): string
    {
        return 'Ventes confirmées ou payées (MAD TTC, transport inclus) et demandes reçues, '.($this->period() === '12m' ? 'par mois' : 'par jour').', en heure de Casablanca.';
    }

    protected function getType(): string
    {
        return 'line';
    }

    protected function getData(): array
    {
        $period = $this->period();
        $series = AnalyticsQueries::cached('sales-series', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return AnalyticsQueries::salesSeries($r['from'], $r['to']);
        });

        return [
            'labels' => $series['labels'],
            'datasets' => [
                ['label' => 'Chiffre d’affaires (MAD)', 'data' => $series['revenue'], 'borderColor' => ChartPalette::BRAND, 'backgroundColor' => ChartPalette::BRAND_SOFT, 'fill' => true, 'tension' => 0.3, 'yAxisID' => 'y'],
                ['label' => 'Demandes reçues', 'data' => $series['requests'], 'borderColor' => ChartPalette::NEUTRAL, 'backgroundColor' => ChartPalette::NEUTRAL, 'borderDash' => [4, 4], 'tension' => 0.3, 'yAxisID' => 'y1'],
            ],
        ];
    }

    protected function getOptions(): RawJs
    {
        return RawJs::make(<<<'JS'
            {
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'bottom' } },
                scales: {
                    y: { beginAtZero: true, position: 'left', ticks: { callback: (value) => new Intl.NumberFormat('fr-FR').format(value) + ' MAD' } },
                    y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
                },
            }
        JS);
    }
}
