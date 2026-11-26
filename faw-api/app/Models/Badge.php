<?php

namespace App\Models;

class Badge extends ShopModel
{
    protected $table = 'Badge';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
