<?php

namespace App\Models;

class InboxMessage extends ShopModel
{
    protected static function booted(): void
    {
        parent::booted();
        static::saving(function ($m) {
            $m->phone = (string) ($m->phone ?? '');
        });
    }

    protected $table = 'InboxMessage';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = ['photos' => 'array'];
}
