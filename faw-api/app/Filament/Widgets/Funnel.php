<?php

namespace App\Filament\Widgets;

use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Site funnel from first-party events (Analytics page). */
class Funnel extends StatsOverviewWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected ?string $pollingInterval = null;

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    protected function getHeading(): ?string
    {
        return 'Parcours sur le site — '.$this->periodLabel();
    }

    protected function getStats(): array
    {
        $period = $this->period();
        $counts = AnalyticsQueries::cached('funnel', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return AnalyticsQueries::funnel($r['from'], $r['to']);
        });

        return [
            Stat::make('Vues', $counts['view'] ?? 0)->description('Pages vues (événements, pas visiteurs uniques)'),
            Stat::make('Ajouts panier', $counts['add_to_cart'] ?? 0),
            Stat::make('Demandes de devis', $counts['quote_request'] ?? 0),
            Stat::make('Commandes soumises', $counts['order'] ?? 0),
        ];
    }
}
