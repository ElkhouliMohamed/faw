<?php

namespace App\Filament\Widgets;

use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;
use Illuminate\Support\Facades\DB;

class Funnel extends StatsOverviewWidget
{
    protected static bool $isDiscovered = false;

    public static function canView(): bool
    {
        return auth()->check();
    }

    protected function getStats(): array
    {
        $counts = DB::table('Event')->where('at', '>=', now()->subDays(30)->getTimestampMs())->select('type')->selectRaw('COUNT(*) as n')->groupBy('type')->pluck('n', 'type');

        return [Stat::make('Vues (événements, pas visiteurs uniques)', $counts['view'] ?? 0), Stat::make('Ajouts panier', $counts['add_to_cart'] ?? 0), Stat::make('Demandes de devis', $counts['quote_request'] ?? 0), Stat::make('Commandes soumises', $counts['order'] ?? 0)];
    }
}
