<?php

namespace App\Filament\Widgets;

use App\Filament\Resources\Carts\CartResource;
use App\Filament\Resources\Quotes\QuoteResource;
use App\Filament\Widgets\Concerns\UsesAnalyticsPeriod;
use App\Services\AnalyticsQueries;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** Owner KPI cards: the chosen period compared with the previous period of the same length. */
class ShopStats extends StatsOverviewWidget
{
    use UsesAnalyticsPeriod;

    protected static bool $isDiscovered = false;

    protected static ?int $sort = 1;

    protected ?string $pollingInterval = null;

    protected int|array|null $columns = ['default' => 1, 'sm' => 2, 'xl' => 4];

    public static function canView(): bool
    {
        return static::canViewAnalytics();
    }

    protected function getHeading(): ?string
    {
        return 'Indicateurs clés — '.$this->periodLabel();
    }

    protected function getDescription(): ?string
    {
        return 'Comparés à la période précédente de même durée. Montants TTC en dirhams (MAD). Chiffres mis à jour toutes les '.AnalyticsQueries::CACHE_MINUTES.' minutes.';
    }

    protected function getStats(): array
    {
        $period = $this->period();
        ['current' => $now, 'previous' => $before, 'backlog' => $backlog] = AnalyticsQueries::cached('kpis', $period, function () use ($period) {
            $r = AnalyticsQueries::range($period);

            return ['current' => AnalyticsQueries::kpis($r['from'], $r['to']), 'previous' => AnalyticsQueries::kpis($r['prevFrom'], $r['prevTo']), 'backlog' => AnalyticsQueries::quoteBacklog()];
        });

        $quotesUrl = QuoteResource::canViewAny() ? QuoteResource::getUrl() : null;

        return [
            $this->compare(Stat::make('Chiffre d’affaires', static::money($now['revenue'])), $now['revenue'], $before['revenue'])
                ->icon(Heroicon::OutlinedBanknotes)
                ->extraAttributes(['title' => 'Commandes boutique confirmées ou livrées + commandes issues de devis au paiement confirmé.']),
            $this->compare(Stat::make('Commandes', number_format($now['orders'], 0, ',', ' ')), $now['orders'], $before['orders'])
                ->icon(Heroicon::OutlinedShoppingBag),
            $this->compare(Stat::make('Panier moyen', static::money($now['averageBasket'])), $now['averageBasket'], $before['averageBasket'])
                ->icon(Heroicon::OutlinedCalculator),
            $this->compare(Stat::make('Demandes de devis', number_format($now['quotes'], 0, ',', ' ')), $now['quotes'], $before['quotes'])
                ->icon(Heroicon::OutlinedDocumentText)->url($quotesUrl),
            $this->comparePoints(Stat::make('Conversion devis → commande', number_format($now['conversionRate'], 1, ',', ' ').' %'), $now['conversionRate'], $before['conversionRate'])
                ->icon(Heroicon::OutlinedArrowPath),
            Stat::make('Devis à valider', $backlog['toValidate'])
                ->icon(Heroicon::OutlinedClock)
                ->description('À valider par l’équipe · '.$backlog['awaitingClient'].' envoyé(s) sans réponse du client')
                ->color($backlog['toValidate'] > 0 ? 'warning' : 'success')
                ->url($quotesUrl),
            $this->compare(Stat::make('Paniers abandonnés', $now['abandonedCarts']), $now['abandonedCarts'], $before['abandonedCarts'], higherIsBetter: false, extra: static::money($now['abandonedValue']).' en attente')
                ->icon(Heroicon::OutlinedShoppingCart)
                ->url(CartResource::canViewAny() ? CartResource::getUrl() : null),
            $this->compare(Stat::make('Nouveaux clients', $now['newCustomers']), $now['newCustomers'], $before['newCustomers'])
                ->icon(Heroicon::OutlinedUserPlus),
        ];
    }

    /** "↑ 12 % vs période précédente" (green when it is good news, red otherwise). */
    protected function compare(Stat $stat, int|float $current, int|float $previous, bool $higherIsBetter = true, ?string $extra = null): Stat
    {
        if ($previous == 0) {
            $text = $current == 0 ? 'Aucun sur les deux périodes' : 'Nouveau : rien sur la période précédente';
            $up = $current > 0;
            $flat = $current == 0;
        } else {
            $pct = ($current - $previous) * 100 / $previous;
            $flat = abs($pct) < 0.5;
            $up = $pct > 0;
            $text = $flat ? '= stable vs période précédente' : ($up ? '↑ ' : '↓ ').number_format(abs($pct), 0, ',', ' ').' % vs période précédente';
        }

        return $this->decorate($stat, $extra ? $extra.' · '.$text : $text, $up, $flat, $higherIsBetter);
    }

    /** Rates are compared in percentage points. */
    protected function comparePoints(Stat $stat, float $current, float $previous): Stat
    {
        $diff = $current - $previous;
        $flat = abs($diff) < 0.05;
        $text = $flat ? '= stable vs période précédente' : ($diff > 0 ? '↑ ' : '↓ ').number_format(abs($diff), 1, ',', ' ').' pt vs période précédente';

        return $this->decorate($stat, $text, $diff > 0, $flat, true);
    }

    protected function decorate(Stat $stat, string $text, bool $up, bool $flat, bool $higherIsBetter): Stat
    {
        return $stat->description($text)
            ->descriptionIcon($flat ? Heroicon::Minus : ($up ? Heroicon::ArrowTrendingUp : Heroicon::ArrowTrendingDown))
            ->color($flat ? 'gray' : (($up === $higherIsBetter) ? 'success' : 'danger'));
    }
}
