<?php

namespace App\Services;

use App\Models\ShopOrder;
use Illuminate\Database\Eloquent\Builder;

class AnalyticsQueries
{
    protected static function recent(Builder $q): Builder
    {
        return $q->whereRaw("CASE WHEN typeof(o.createdAt)='integer' THEN CAST(o.createdAt AS INTEGER)/1000 ELSE CAST(strftime('%s',o.createdAt) AS INTEGER) END >= ?", [now()->subDays(30)->timestamp]);
    }

    public static function daily(): Builder
    {
        $minutes = now('Africa/Casablanca')->offsetMinutes;
        $day = "date(CASE WHEN typeof(o.createdAt)='integer' THEN datetime(o.createdAt/1000,'unixepoch') ELSE o.createdAt END, '".($minutes >= 0 ? '+' : '').$minutes." minutes')";

        return static::recent(ShopOrder::from('Order as o')->leftJoin('Quote as q', 'q.orderId', '=', 'o.id'))->selectRaw("MIN(o.id) as id,$day as period,COUNT(DISTINCT o.id) as requests,COUNT(DISTINCT q.id) as quotes,SUM(CASE WHEN o.status IN ('confirmé','livré') THEN o.total ELSE 0 END) as sales")->groupByRaw($day)->orderByDesc('period');
    }

    public static function cities(): Builder
    {
        return static::recent(ShopOrder::from('Order as o'))->selectRaw("MIN(o.id) as id,o.city,COUNT(*) as requests,SUM(CASE WHEN o.status IN ('confirmé','livré') THEN o.total ELSE 0 END) as sales")->groupBy('o.city')->orderByDesc('requests');
    }

    public static function products(): Builder
    {
        return static::recent(ShopOrder::from('Order as o')->join('OrderItem as l', 'l.orderId', '=', 'o.id'))->selectRaw("MIN(l.id) as id,l.productId,MAX(l.title) as title,SUM(l.quantity) as quantity,COUNT(DISTINCT o.id) as requests,ROUND(SUM(CASE WHEN o.status IN ('confirmé','livré') THEN l.lineTotal * (o.subtotal-o.couponDiscount)*1.0/NULLIF(o.subtotal,0) ELSE 0 END),2) as sales")->groupBy('l.productId')->orderByDesc('quantity');
    }
}
