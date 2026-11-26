<?php

namespace App\Models;

use App\Services\ContentBlocks;
use App\Services\SafeHtml;

class ContentPage extends ShopModel
{
    protected $table = 'ContentPage';

    public $timestamps = true;

    protected $guarded = [];

    protected $casts = ['blocks' => 'array', 'tags' => 'array', 'published' => 'boolean', 'publishedAt' => 'datetime', 'defaultSections' => 'boolean'];

    protected static function booted(): void
    {
        parent::booted();
        static::saving(function ($m) {
            $m->tags = array_values(array_map('strval', $m->tags ?? []));
            $m->blocks = ContentBlocks::normalize($m->blocks ?? []);
            $m->bodyHtml = SafeHtml::clean($m->bodyHtml);
        });
    }
}
