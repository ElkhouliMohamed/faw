<?php

namespace App\Models;

class Warranty extends ShopModel
{
    protected $table = 'Warranty';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
