<?php

namespace App\Models;

class BlogTag extends ShopModel
{
    protected $table = 'BlogTag';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
