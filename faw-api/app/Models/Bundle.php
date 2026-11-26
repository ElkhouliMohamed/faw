<?php

namespace App\Models;

class Bundle extends ShopModel
{
    protected $table = 'Bundle';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean', 'items' => 'array'];
}
