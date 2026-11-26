<?php

namespace App\Models;

class Setting extends ShopModel
{
    protected $table = 'Setting';

    public $timestamps = false;

    protected $guarded = [];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $primaryKey = 'key';

    protected $casts = [];
}
