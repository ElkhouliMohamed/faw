<?php

namespace App\Models;

class Customer extends ShopModel
{
    protected $table = 'Contact';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [];
}
