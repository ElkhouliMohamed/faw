<?php

namespace App\Models;

class Product extends ShopModel
{
    protected $table = 'Product';

    public $timestamps = false;

    protected $guarded = [];

    public $incrementing = false;

    protected $keyType = 'string';

    /** Stored for later; the public site stays « devis uniquement » while prices are hidden (no effect on ordering). */
    public const SALES_MODES = ['quote_only' => 'Devis uniquement', 'direct' => 'Achat direct (inactif)', 'both' => 'Devis + achat direct (inactif)'];

    protected static function booted(): void
    {
        parent::booted();
        static::saving(function (Product $p) {
            $p->salesMode = array_key_exists((string) $p->salesMode, self::SALES_MODES) ? $p->salesMode : 'quote_only';
        });
    }

    protected $casts = ['active' => 'boolean', 'priceToConfirm' => 'boolean', 'stockToConfirm' => 'boolean', 'price' => 'integer', 'stockQty' => 'integer', 'sortOrder' => 'integer'];
}
