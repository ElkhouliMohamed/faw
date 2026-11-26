<?php

namespace App\Models;

class Coupon extends ShopModel
{
    protected $table = 'Coupon';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
