<?php

namespace App\Models;

class Product extends ShopModel
{
    protected $table = 'Product';

    public $timestamps = false;

    protected $guarded = [];

    public $incrementing = false;

    protected $keyType = 'string';

    /**
     * Price mode. « direct »: price shown, add to cart and buy online. « quote_only »: no price, « Demander un devis ».
     * The global « prices hidden » setting overrides both (everything falls back to quote mode): see PriceVisibility.
     */
    public const SALES_MODES = ['direct' => 'Achat en ligne', 'quote_only' => 'Sur devis'];

    protected static function booted(): void
    {
        parent::booted();
        static::saving(function (Product $p) {
            $mode = $p->salesMode;
            // Not set = column default (« direct », today's behaviour); legacy « both » = online; anything else = quote (safe).
            $p->salesMode = $mode === null || $mode === '' || $mode === 'both' ? 'direct' : (array_key_exists((string) $mode, self::SALES_MODES) ? $mode : 'quote_only');
            if ($p->maxOnlineQty !== null && (int) $p->maxOnlineQty < 1) {
                $p->maxOnlineQty = null;
            }
        });
    }

    protected $casts = ['active' => 'boolean', 'priceToConfirm' => 'boolean', 'stockToConfirm' => 'boolean', 'price' => 'integer', 'stockQty' => 'integer', 'sortOrder' => 'integer', 'maxOnlineQty' => 'integer'];
}
