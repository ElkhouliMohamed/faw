<?php

namespace App\Models;

class Cart extends ShopModel
{
    protected $table = 'Cart';

    public $timestamps = false;

    protected $guarded = [];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $casts = [];
}
