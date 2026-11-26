<?php

namespace App\Models;

class FeeRule extends ShopModel
{
    protected $table = 'FeeRule';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
