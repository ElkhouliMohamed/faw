<?php

namespace App\Models;

class Attribute extends ShopModel
{
    protected $table = 'Attribute';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean', 'showInSpecs' => 'boolean'];
}
