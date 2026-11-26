<?php

namespace App\Models;

class Activity extends ShopModel
{
    protected $table = 'LeadEvent';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [];
}
