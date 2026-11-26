<?php

namespace App\Models;

use App\Support\OrderStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Order created from an accepted quote version (lines, prices, tax and delivery option copied at acceptance). */
class CustomerOrder extends Model
{
    /** Copied from the accepted version: never edited afterwards. */
    public const FROZEN = ['reference', 'quote_id', 'quote_version_id', 'quote_decision_id', 'version_number', 'lines', 'totals', 'total_ttc', 'currency', 'tax_rate', 'delivery'];

    protected $table = 'customer_orders';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['lines' => 'array', 'totals' => 'array', 'delivery' => 'array', 'total_ttc' => 'integer', 'tax_rate' => 'integer', 'status_changed_at' => 'immutable_datetime', 'status' => OrderStatus::class];
    }

    protected static function booted(): void
    {
        static::updating(function (CustomerOrder $o) {
            if ($frozen = array_intersect(array_keys($o->getDirty()), self::FROZEN)) {
                throw new \LogicException('Commande : contenu du devis accepté figé ('.implode(', ', $frozen).').');
            }
        });
        static::deleting(fn () => throw new \LogicException('Commande : suppression interdite (annuler à la place).'));
    }

    public function history(): HasMany
    {
        return $this->hasMany(OrderStatusHistory::class, 'customer_order_id')->orderBy('id');
    }
}
