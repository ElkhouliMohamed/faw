<?php

namespace App\Models;

class Popup extends ShopModel
{
    protected $table = 'Popup';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
