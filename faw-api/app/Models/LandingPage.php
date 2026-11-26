<?php

namespace App\Models;

class LandingPage extends ShopModel
{
    protected $table = 'LandingPage';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['published' => 'boolean', 'blocks' => 'array'];
}
