<?php

namespace App\Services;

use App\Models\ShopOrder;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Dashboard aggregates over the shop tables. Portable SQL (PostgreSQL and SQLite):
 * "createdAt" is stored as epoch milliseconds, camelCase identifiers are quoted by the grammar.
 */
class AnalyticsQueries
{
    private const DAY_MS = 86_400_000;

    protected static function w(string $identifier): string
    {
        return DB::getQueryGrammar()->wrap($identifier);
    }

    protected static function recent(Builder $q): Builder
    {
        return $q->where('o.createdAt', '>=', now()->subDays(30)->getTimestampMs());
    }

    /** "period" is the Casablanca calendar day as a day number since 1970-01-01 (see dayLabel()). */
    public static function daily(): Builder
    {
        $offsetMs = now('Africa/Casablanca')->offsetMinutes * 60_000;
        $day = '(('.static::w('o.createdAt').' + '.(int) $offsetMs.') / '.self::DAY_MS.')';

        return static::recent(ShopOrder::from('Order as o')->leftJoin('Quote as q', 'q.orderId', '=', 'o.id'))->selectRaw("MIN(o.id) as id,$day as period,COUNT(DISTINCT o.id) as requests,COUNT(DISTINCT q.id) as quotes,SUM(CASE WHEN o.status IN ('confirmé','livré') THEN o.total ELSE 0 END) as sales")->groupByRaw($day)->orderByDesc('period');
    }

    public static function dayLabel(mixed $period): string
    {
        return is_numeric($period) ? CarbonImmutable::createFromTimestampUTC((int) $period * 86_400)->format('Y-m-d') : (string) $period;
    }

    public static function cities(): Builder
    {
        return static::recent(ShopOrder::from('Order as o'))->selectRaw("MIN(o.id) as id,o.city,COUNT(*) as requests,SUM(CASE WHEN o.status IN ('confirmé','livré') THEN o.total ELSE 0 END) as sales")->groupBy('o.city')->orderByDesc('requests');
    }

    public static function products(): Builder
    {
        $line = static::w('l.lineTotal');
        $subtotal = static::w('o.subtotal');
        $discount = static::w('o.couponDiscount');

        return static::recent(ShopOrder::from('Order as o')->join('OrderItem as l', 'l.orderId', '=', 'o.id'))->selectRaw('MIN(l.id) as id,'.static::w('l.productId').',MAX(l.title) as title,SUM(l.quantity) as quantity,COUNT(DISTINCT o.id) as requests,'."ROUND(CAST(SUM(CASE WHEN o.status IN ('confirmé','livré') THEN {$line} * ({$subtotal}-{$discount})*1.0/NULLIF({$subtotal},0) ELSE 0 END) AS NUMERIC),2) as sales")->groupBy('l.productId')->orderByDesc('quantity');
    }
}
