<?php

namespace App\Models;

class BlogCategory extends ShopModel
{
    protected $table = 'BlogCategory';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
