<?php

namespace App\Services;

use App\Models\ShopOrder;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Query\Builder as QueryBuilder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard and analytics aggregates. Every figure is computed in SQL (GROUP BY / SUM), never by loading rows.
 * Portable SQL (PostgreSQL first, SQLite still works): camelCase identifiers are quoted by the grammar.
 * The historical shop tables ("Order", "Quote", "Contact", "Cart", "Event") store dates as BIGINT epoch
 * milliseconds (see App\Casts\ShopTimestamp); customer_orders / payments use regular timestamps (UTC).
 *
 * Definitions used everywhere (dashboard and Analytics page):
 * - commande : demande « Order » passée sans devis (paiement en ligne / à la livraison / virement) + commande
 *   issue d'un devis accepté (customer_orders) ;
 * - chiffre d'affaires : commandes boutique au statut confirmé ou livré + commandes issues de devis dont le
 *   paiement est confirmé (ou plus avancées). Une demande déjà transformée en commande n'est comptée qu'une fois.
 */
class AnalyticsQueries
{
    private const DAY_MS = 86_400_000;

    public const PERIODS = ['7j' => '7 jours', '30j' => '30 jours', '90j' => '90 jours', '12m' => '12 mois'];

    public const DEFAULT_PERIOD = '30j';

    /** Minutes during which heavy aggregates are cached (same figures for every back-office user). */
    public const CACHE_MINUTES = 5;

    /** Shop "Order" statuses that count as a sale. */
    public const SHOP_SOLD = ['confirmé', 'livré'];

    /** customer_orders statuses that count as paid (payment confirmed or later, cancelled excluded). */
    public const ORDER_PAID = ['paiement_confirme', 'en_traitement', 'en_preparation', 'pret_retrait', 'en_livraison', 'livre', 'termine'];

    /** Readable pipeline used by the "Commandes par statut" chart: both status vocabularies map onto it. */
    public const STAGES = [
        'nouveau' => 'À traiter', 'à contacter' => 'À traiter',
        'en cours' => 'En cours', 'devis envoyé' => 'En cours',
        'confirmé' => 'Confirmée / payée', 'livré' => 'Livrée / terminée', 'annulé' => 'Annulée',
        'en_attente_paiement' => 'En attente de paiement', 'partiellement_paye' => 'En attente de paiement',
        'paiement_confirme' => 'Confirmée / payée',
        'en_traitement' => 'En cours', 'en_preparation' => 'En cours', 'pret_retrait' => 'En cours', 'en_livraison' => 'En cours',
        'livre' => 'Livrée / terminée', 'termine' => 'Livrée / terminée', 'annule' => 'Annulée',
    ];

    protected static function w(string $identifier): string
    {
        return DB::getQueryGrammar()->wrap($identifier);
    }

    /** @param  list<string>  $values  constant literals only */
    protected static function in(array $values): string
    {
        return implode(',', array_map(fn (string $v) => "'".str_replace("'", "''", $v)."'", $values));
    }

    protected static function ms(CarbonImmutable $at): int
    {
        return $at->getTimestampMs();
    }

    // ---------------------------------------------------------------- periods and cache

    public static function period(?string $key): string
    {
        return array_key_exists((string) $key, self::PERIODS) ? (string) $key : self::DEFAULT_PERIOD;
    }

    /**
     * Current window [from, to[ and the previous window of the same length.
     *
     * @return array{from: CarbonImmutable, to: CarbonImmutable, prevFrom: CarbonImmutable, prevTo: CarbonImmutable}
     */
    public static function range(?string $period, ?CarbonImmutable $now = null): array
    {
        $to = ($now ?? CarbonImmutable::now())->utc();
        $from = match (self::period($period)) {
            '7j' => $to->subDays(7),
            '90j' => $to->subDays(90),
            '12m' => $to->subMonths(12),
            default => $to->subDays(30),
        };

        return ['from' => $from, 'to' => $to, 'prevFrom' => CarbonImmutable::createFromTimestampMs(2 * self::ms($from) - self::ms($to), 'UTC'), 'prevTo' => $from];
    }

    /** Caches one aggregate for a few minutes, per period. */
    public static function cached(string $name, ?string $period, Closure $compute): mixed
    {
        return Cache::remember('faw:analytics:'.$name.':'.self::period($period), now()->addMinutes(self::CACHE_MINUTES), $compute);
    }

    // ---------------------------------------------------------------- shared sub-queries

    /** Shop requests that are quote requests (one row per "Order" id). */
    protected static function quotedOrders(): QueryBuilder
    {
        return DB::table('Quote as qq')->whereNotNull('qq.orderId')->select('qq.orderId')->distinct();
    }

    /** Shop requests whose quote became a customer order: their revenue is counted on customer_orders. */
    protected static function convertedOrders(): QueryBuilder
    {
        return DB::table('Quote as cq')->join('customer_orders as cco', 'cco.quote_id', '=', 'cq.id')->whereNotNull('cq.orderId')->select('cq.orderId')->distinct();
    }

    /** SQL expression: revenue of one shop request (alias o, converted sub-query alias cv). */
    protected static function shopRevenueSql(): string
    {
        return 'CASE WHEN o.status IN ('.self::in(self::SHOP_SOLD).') AND '.static::w('cv.orderId').' IS NULL THEN o.total ELSE 0 END';
    }

    protected static function orderPaidSql(string $column = 'total_ttc'): string
    {
        return 'CASE WHEN status IN ('.self::in(self::ORDER_PAID).') THEN '.$column.' ELSE 0 END';
    }

    protected static function shopOrders(CarbonImmutable $from, CarbonImmutable $to): QueryBuilder
    {
        return DB::table('Order as o')
            ->leftJoinSub(self::convertedOrders(), 'cv', 'cv.orderId', '=', 'o.id')
            ->where('o.createdAt', '>=', self::ms($from))->where('o.createdAt', '<', self::ms($to));
    }

    protected static function customerOrders(CarbonImmutable $from, CarbonImmutable $to): QueryBuilder
    {
        return DB::table('customer_orders')->where('created_at', '>=', $from->utc())->where('created_at', '<', $to->utc());
    }

    // ---------------------------------------------------------------- KPI cards

    /**
     * Every KPI of one window, in a handful of aggregate queries.
     *
     * @return array{revenue: int, orders: int, sold: int, averageBasket: int, quotes: int, convertedQuotes: int, conversionRate: float, newCustomers: int, abandonedCarts: int, abandonedValue: int}
     */
    public static function kpis(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $w = fn (string $id) => static::w($id);
        $revenue = self::shopRevenueSql();

        $shop = self::shopOrders($from, $to)
            ->leftJoinSub(self::quotedOrders(), 'qo', 'qo.orderId', '=', 'o.id')
            ->selectRaw("SUM(CASE WHEN {$w('qo.orderId')} IS NULL THEN 1 ELSE 0 END) as orders, SUM({$revenue}) as revenue, SUM(CASE WHEN o.status IN (".self::in(self::SHOP_SOLD).") AND {$w('cv.orderId')} IS NULL THEN 1 ELSE 0 END) as sold")
            ->first();

        $orders = self::customerOrders($from, $to)
            ->selectRaw('COUNT(*) as orders, SUM('.self::orderPaidSql().') as revenue, SUM('.self::orderPaidSql('1').') as sold')
            ->first();

        $quotes = DB::table('Quote as q')
            ->leftJoin('customer_orders as co', 'co.quote_id', '=', 'q.id')
            ->leftJoin('Order as o', 'o.id', '=', 'q.orderId')
            ->where('q.createdAt', '>=', self::ms($from))->where('q.createdAt', '<', self::ms($to))
            ->selectRaw("COUNT(*) as quotes, SUM(CASE WHEN co.id IS NOT NULL OR {$w('q.customerDecision')} = 'accepté' OR o.status IN (".self::in(self::SHOP_SOLD).') THEN 1 ELSE 0 END) as converted')
            ->first();

        $newCustomers = DB::table('Contact')->where('createdAt', '>=', self::ms($from))->where('createdAt', '<', self::ms($to))->count();

        // Same rule as the "Paniers abandonnés" list: items, not recovered, no activity for 30 minutes.
        $cartLimit = min(self::ms($to), now()->subMinutes(30)->getTimestampMs());
        $carts = DB::table('Cart')->where('itemCount', '>', 0)->where('status', '!=', 'récupéré')
            ->where('updatedAt', '>=', self::ms($from))->where('updatedAt', '<', $cartLimit)
            ->selectRaw('COUNT(*) as n, SUM(subtotal) as value')->first();

        $revenueTotal = (int) ($shop->revenue ?? 0) + (int) ($orders->revenue ?? 0);
        $sold = (int) ($shop->sold ?? 0) + (int) ($orders->sold ?? 0);
        $quoteCount = (int) ($quotes->quotes ?? 0);
        $converted = (int) ($quotes->converted ?? 0);

        return [
            'revenue' => $revenueTotal,
            'orders' => (int) ($shop->orders ?? 0) + (int) ($orders->orders ?? 0),
            'sold' => $sold,
            'averageBasket' => $sold > 0 ? (int) round($revenueTotal / $sold) : 0,
            'quotes' => $quoteCount,
            'convertedQuotes' => $converted,
            'conversionRate' => $quoteCount > 0 ? round($converted * 100 / $quoteCount, 1) : 0.0,
            'newCustomers' => $newCustomers,
            'abandonedCarts' => (int) ($carts->n ?? 0),
            'abandonedValue' => (int) ($carts->value ?? 0),
        ];
    }

    /**
     * Current backlog (not tied to a period).
     *
     * @return array{toValidate: int, awaitingClient: int}
     */
    public static function quoteBacklog(): array
    {
        $w = fn (string $id) => static::w($id);
        $row = DB::table('Quote as q')->leftJoin('customer_orders as co', 'co.quote_id', '=', 'q.id')
            ->selectRaw("SUM(CASE WHEN q.status = 'à valider' THEN 1 ELSE 0 END) as to_validate, SUM(CASE WHEN q.status IN ('validé','envoyé') AND {$w('q.customerDecision')} IS NULL AND {$w('q.cancelledAt')} IS NULL AND co.id IS NULL THEN 1 ELSE 0 END) as awaiting_client")
            ->first();

        return ['toValidate' => (int) ($row->to_validate ?? 0), 'awaitingClient' => (int) ($row->awaiting_client ?? 0)];
    }

    // ---------------------------------------------------------------- time series

    /** Casablanca calendar day (days since 1970-01-01) of an epoch-milliseconds column. */
    protected static function dayFromMs(string $column): string
    {
        $offsetMs = now('Africa/Casablanca')->offsetMinutes * 60_000;

        return '(('.static::w($column).' + '.(int) $offsetMs.') / '.self::DAY_MS.')';
    }

    /** Casablanca calendar day of a timestamp column (stored in UTC). */
    protected static function dayFromTimestamp(string $column): string
    {
        $offset = (int) now('Africa/Casablanca')->offsetMinutes * 60;
        $col = static::w($column);

        return match (DB::connection()->getDriverName()) {
            'pgsql' => "CAST(FLOOR((EXTRACT(EPOCH FROM {$col}) + {$offset}) / 86400) AS BIGINT)",
            'sqlite' => "((CAST(strftime('%s', {$col}) AS INTEGER) + {$offset}) / 86400)",
            default => "FLOOR((UNIX_TIMESTAMP({$col}) + {$offset}) / 86400)",
        };
    }

    /**
     * Shop requests per Casablanca day: requests, quote requests and confirmed sales (TTC, delivery included).
     * "period" is the day number since 1970-01-01 (see dayLabel()).
     */
    public static function daily(?CarbonImmutable $from = null, ?CarbonImmutable $to = null): Builder
    {
        $to ??= CarbonImmutable::now();
        $from ??= $to->subDays(30);
        $day = self::dayFromMs('o.createdAt');
        $quotesPerOrder = DB::table('Quote')->whereNotNull('orderId')->select('orderId')->selectRaw('COUNT(*) as n')->groupBy('orderId');

        return ShopOrder::from('Order as o')
            ->leftJoinSub(self::convertedOrders(), 'cv', 'cv.orderId', '=', 'o.id')
            ->leftJoinSub($quotesPerOrder, 'qc', 'qc.orderId', '=', 'o.id')
            ->where('o.createdAt', '>=', self::ms($from))->where('o.createdAt', '<', self::ms($to))
            ->selectRaw("MIN(o.id) as id,{$day} as period,COUNT(*) as requests,SUM(COALESCE(qc.n,0)) as quotes,SUM(".self::shopRevenueSql().') as sales')
            ->groupByRaw($day)->orderByDesc('period');
    }

    public static function dayLabel(mixed $period): string
    {
        return is_numeric($period) ? CarbonImmutable::createFromTimestampUTC((int) $period * 86_400)->format('Y-m-d') : (string) $period;
    }

    /**
     * Revenue and requests per day (per month beyond 92 days), every bucket present even when empty.
     *
     * @return array{labels: list<string>, revenue: list<int>, requests: list<int>}
     */
    public static function salesSeries(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $buckets = [];
        foreach (self::daily($from, $to)->get() as $row) {
            $buckets[(int) $row->period] = ['revenue' => (int) $row->sales, 'requests' => (int) $row->requests];
        }
        $day = self::dayFromTimestamp('created_at');
        $orders = self::customerOrders($from, $to)->selectRaw("{$day} as period, SUM(".self::orderPaidSql().') as revenue')->groupByRaw($day)->get();
        foreach ($orders as $row) {
            $buckets[(int) $row->period]['revenue'] = ($buckets[(int) $row->period]['revenue'] ?? 0) + (int) $row->revenue;
        }

        $offset = now('Africa/Casablanca')->offsetMinutes * 60;
        $first = intdiv($from->getTimestamp() + $offset, 86_400);
        $last = intdiv($to->getTimestamp() + $offset, 86_400);
        $monthly = $last - $first > 92;
        $out = [];
        for ($d = $first; $d <= $last; $d++) {
            $date = CarbonImmutable::createFromTimestampUTC($d * 86_400)->locale('fr');
            $key = $monthly ? $date->format('Y-m') : (string) $d;
            $out[$key] ??= ['label' => $monthly ? ucfirst($date->translatedFormat('M Y')) : $date->format('d/m'), 'revenue' => 0, 'requests' => 0];
            $out[$key]['revenue'] += $buckets[$d]['revenue'] ?? 0;
            $out[$key]['requests'] += $buckets[$d]['requests'] ?? 0;
        }

        return ['labels' => array_column($out, 'label'), 'revenue' => array_column($out, 'revenue'), 'requests' => array_column($out, 'requests')];
    }

    // ---------------------------------------------------------------- breakdowns

    /** @return array<string, int> stage label => count, in pipeline order (empty stages omitted) */
    public static function ordersByStatus(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $shop = self::shopOrders($from, $to)->leftJoinSub(self::quotedOrders(), 'qo', 'qo.orderId', '=', 'o.id')
            ->whereNull('qo.orderId')->select('o.status')->selectRaw('COUNT(*) as n')->groupBy('o.status')->pluck('n', 'status');
        $orders = self::customerOrders($from, $to)->select('status')->selectRaw('COUNT(*) as n')->groupBy('status')->pluck('n', 'status');

        $stages = array_fill_keys(array_values(array_unique(self::STAGES)), 0) + ['Autre' => 0];
        foreach ([$shop, $orders] as $counts) {
            foreach ($counts as $status => $n) {
                $stages[self::STAGES[$status] ?? 'Autre'] += (int) $n;
            }
        }

        return array_filter($stages);
    }

    /** @return list<array{city: string, requests: int, sales: int}> */
    public static function topCities(CarbonImmutable $from, CarbonImmutable $to, int $limit = 8): array
    {
        $key = 'LOWER(TRIM(o.city))';
        $rows = [];
        foreach (self::shopOrders($from, $to)->selectRaw("{$key} as k, MAX(o.city) as city, COUNT(*) as requests, SUM(".self::shopRevenueSql().') as sales')->groupByRaw($key)->get() as $r) {
            $rows[(string) $r->k] = ['city' => trim((string) $r->city), 'requests' => (int) $r->requests, 'sales' => (int) $r->sales];
        }
        // Orders from accepted quotes: the request is already counted above, only their revenue is added.
        $coKey = "LOWER(TRIM(COALESCE(city,'')))";
        foreach (self::customerOrders($from, $to)->whereIn('status', self::ORDER_PAID)->selectRaw("{$coKey} as k, MAX(city) as city, SUM(total_ttc) as sales")->groupByRaw($coKey)->get() as $r) {
            $rows[(string) $r->k] ??= ['city' => trim((string) $r->city), 'requests' => 0, 'sales' => 0];
            $rows[(string) $r->k]['sales'] += (int) $r->sales;
        }
        foreach ($rows as &$row) {
            $row['city'] = $row['city'] !== '' ? $row['city'] : 'Non renseignée';
        }
        unset($row);
        usort($rows, fn ($a, $b) => [$b['sales'], $b['requests']] <=> [$a['sales'], $a['requests']]);

        return array_slice(array_values($rows), 0, $limit);
    }

    /**
     * Units requested (every request) and units sold (confirmed shop orders + paid orders from quotes), with revenue
     * excluding delivery (shop coupons spread proportionally).
     *
     * @return list<array{productId: string, title: string, requested: int, sold: int, sales: int}>
     */
    public static function topProducts(CarbonImmutable $from, CarbonImmutable $to, int $limit = 8): array
    {
        $w = fn (string $id) => static::w($id);
        $line = $w('l.lineTotal');
        $subtotal = $w('o.subtotal');
        $discount = $w('o.couponDiscount');
        $sold = 'o.status IN ('.self::in(self::SHOP_SOLD).') AND '.$w('cv.orderId').' IS NULL';

        $rows = [];
        $shop = self::shopOrders($from, $to)->join('OrderItem as l', 'l.orderId', '=', 'o.id')
            ->selectRaw("{$w('l.productId')} as pid, MAX(l.title) as title, SUM(l.quantity) as requested, SUM(CASE WHEN {$sold} THEN l.quantity ELSE 0 END) as sold, "
                ."SUM(CASE WHEN {$sold} THEN {$line} * ({$subtotal} - {$discount}) * 1.0 / NULLIF({$subtotal}, 0) ELSE 0 END) as sales")
            ->groupBy('l.productId')->get();
        foreach ($shop as $r) {
            $rows[(string) $r->pid] = ['productId' => (string) $r->pid, 'title' => (string) $r->title, 'requested' => (int) $r->requested, 'sold' => (int) $r->sold, 'sales' => (int) round((float) $r->sales)];
        }
        foreach (self::orderLines($from, $to) as $r) {
            $rows[(string) $r->pid] ??= ['productId' => (string) $r->pid, 'title' => (string) $r->title, 'requested' => 0, 'sold' => 0, 'sales' => 0];
            $rows[(string) $r->pid]['sold'] += (int) round((float) $r->quantity);
            $rows[(string) $r->pid]['sales'] += (int) round((float) $r->sales);
        }
        usort($rows, fn ($a, $b) => [$b['requested'], $b['sold'], $b['sales']] <=> [$a['requested'], $a['sold'], $a['sales']]);

        return array_slice(array_values($rows), 0, $limit);
    }

    /** Lines of paid customer orders, aggregated in SQL from the JSON "lines" column. */
    protected static function orderLines(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $paid = self::in(self::ORDER_PAID);
        $bindings = [$from->utc()->format('Y-m-d H:i:s'), $to->utc()->format('Y-m-d H:i:s')];

        return match (DB::connection()->getDriverName()) {
            'pgsql' => DB::select("SELECT l.value->>'reference' AS pid, MAX(l.value->>'name') AS title, SUM(CAST(l.value->>'qty' AS NUMERIC)) AS quantity, SUM(CAST(l.value->>'total_ttc' AS NUMERIC)) AS sales
                FROM customer_orders co CROSS JOIN LATERAL json_array_elements(CAST(co.lines AS json)) AS l(value)
                WHERE co.created_at >= ? AND co.created_at < ? AND co.status IN ({$paid}) AND l.value->>'reference' IS NOT NULL
                GROUP BY l.value->>'reference'", $bindings),
            'sqlite' => DB::select("SELECT json_extract(l.value, '$.reference') AS pid, MAX(json_extract(l.value, '$.name')) AS title, SUM(json_extract(l.value, '$.qty')) AS quantity, SUM(json_extract(l.value, '$.total_ttc')) AS sales
                FROM customer_orders co, json_each(co.lines) l
                WHERE co.created_at >= ? AND co.created_at < ? AND co.status IN ({$paid}) AND json_extract(l.value, '$.reference') IS NOT NULL
                GROUP BY json_extract(l.value, '$.reference')", $bindings),
            default => [],
        };
    }

    /** @return list<array{source: string, views: int, quotes: int, orders: int}> */
    public static function trafficSources(CarbonImmutable $from, CarbonImmutable $to, int $limit = 8): array
    {
        $source = "COALESCE(NULLIF(source,''),'direct')";
        $campaign = "COALESCE(campaign,'')";

        return DB::table('Event')->where('at', '>=', self::ms($from))->where('at', '<', self::ms($to))
            ->selectRaw("{$source} as src, {$campaign} as camp, SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) as views, SUM(CASE WHEN type='quote_request' THEN 1 ELSE 0 END) as quotes, SUM(CASE WHEN type='order' THEN 1 ELSE 0 END) as orders")
            ->groupByRaw("{$source}, {$campaign}")->orderByDesc('views')->orderBy('src')->limit($limit)->get()
            ->map(fn ($r) => ['source' => $r->camp !== '' ? $r->src.' · '.$r->camp : (string) $r->src, 'views' => (int) $r->views, 'quotes' => (int) $r->quotes, 'orders' => (int) $r->orders])
            ->all();
    }

    /** @return array<string, int> event type => count */
    public static function funnel(CarbonImmutable $from, CarbonImmutable $to): array
    {
        return DB::table('Event')->where('at', '>=', self::ms($from))->where('at', '<', self::ms($to))
            ->select('type')->selectRaw('COUNT(*) as n')->groupBy('type')->pluck('n', 'type')->map(fn ($n) => (int) $n)->all();
    }
}
