<?php

namespace App\Filament\Widgets\Concerns;

use App\Services\AnalyticsQueries;
use Carbon\CarbonImmutable;
use Filament\Widgets\Concerns\InteractsWithPageFilters;

/** Reads the period chosen on the dashboard / Analytics page (7j, 30j, 90j, 12m; 30 jours by default). */
trait UsesAnalyticsPeriod
{
    use InteractsWithPageFilters;

    protected function period(): string
    {
        return AnalyticsQueries::period($this->pageFilters['period'] ?? null);
    }

    protected function periodLabel(): string
    {
        return AnalyticsQueries::PERIODS[$this->period()];
    }

    /** @return array{from: CarbonImmutable, to: CarbonImmutable, prevFrom: CarbonImmutable, prevTo: CarbonImmutable} */
    protected function range(): array
    {
        return AnalyticsQueries::range($this->period());
    }

    protected static function canViewAnalytics(): bool
    {
        return auth()->user()?->canDo('view.analytics') ?? false;
    }

    protected static function money(int|float $amount): string
    {
        return number_format((float) $amount, 0, ',', ' ').' MAD';
    }
}
