<?php

namespace App\Models;

class ShippingCity extends ShopModel
{
    protected $table = 'ShippingCity';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean', 'available' => 'boolean'];
}
