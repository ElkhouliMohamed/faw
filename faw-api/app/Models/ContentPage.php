<?php

namespace App\Models;

use App\Services\ContentBlocks;
use App\Services\HomeSections;
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
            // The home page uses its own section builder (hero, categories, testimonials...); other kinds keep the landing-page blocks.
            $m->blocks = $m->kind === 'home' ? HomeSections::normalize($m->blocks ?? []) : ContentBlocks::normalize($m->blocks ?? []);
            $m->bodyHtml = SafeHtml::clean($m->bodyHtml);
        });
    }
}
