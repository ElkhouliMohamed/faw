<?php

namespace App\Models;

class ShopOrder extends ShopModel
{
    protected $table = 'Order';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [];
}
