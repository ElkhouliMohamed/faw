<?php

namespace App\Filament\Pages;

use App\Filament\Widgets\CitySales;
use App\Filament\Widgets\DailySales;
use App\Filament\Widgets\Funnel;
use App\Filament\Widgets\OrdersByStatus;
use App\Filament\Widgets\ProductSales;
use App\Filament\Widgets\TrafficSources;
use App\Services\AnalyticsQueries;
use Filament\Actions\Action;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Livewire\Attributes\Url;

/** Detailed first-party analytics. Same figures and period filter as the dashboard (?filters[period]=90j). */
class Analytics extends Page
{
    public static function canAccess(): bool
    {
        return auth()->user()?->canDo('view.analytics') ?? false;
    }

    protected static ?string $navigationLabel = 'Statistiques détaillées';

    protected static ?string $title = 'Statistiques détaillées';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    protected static string|\BackedEnum|null $navigationIcon = Heroicon::OutlinedPresentationChartLine;

    protected static ?int $navigationSort = 90;

    protected string $view = 'filament.pages.analytics';

    /** Passed to every widget as "pageFilters" (see Filament\Pages\Page::getWidgetsSchemaComponents). */
    #[Url]
    public ?array $filters = null;

    public function getSubheading(): ?string
    {
        return 'Période : '.AnalyticsQueries::PERIODS[$this->period()].', comparée sur le tableau de bord à la période précédente.';
    }

    protected function period(): string
    {
        return AnalyticsQueries::period($this->filters['period'] ?? null);
    }

    protected function getHeaderActions(): array
    {
        return array_map(
            fn (string $key, string $label) => Action::make('period_'.$key)
                ->label($label)
                ->color($this->period() === $key ? 'primary' : 'gray')
                ->outlined($this->period() !== $key)
                ->url(static::getUrl(['filters' => ['period' => $key]])),
            array_keys(AnalyticsQueries::PERIODS),
            AnalyticsQueries::PERIODS,
        );
    }

    protected function getHeaderWidgets(): array
    {
        return [Funnel::class];
    }

    protected function getFooterWidgets(): array
    {
        return [DailySales::class, OrdersByStatus::class, ProductSales::class, CitySales::class, TrafficSources::class];
    }

    public function getFooterWidgetsColumns(): int|array
    {
        return ['default' => 1, 'lg' => 2];
    }
}
