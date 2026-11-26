<?php

namespace App\Models;

class Promotion extends ShopModel
{
    protected $table = 'Promotion';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
