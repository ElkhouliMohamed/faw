<?php

namespace App\Providers;

use App\Models\Attribute;
use App\Models\Badge;
use App\Models\Bundle;
use App\Models\Category;
use App\Models\ContentPage;
use App\Models\FeeRule;
use App\Models\LandingPage;
use App\Models\Popup;
use App\Models\Product;
use App\Models\Promotion;
use App\Models\Redirect;
use App\Models\Setting;
use App\Models\ShippingCity;
use App\Models\SiteMenu;
use App\Models\SystemConfig;
use App\Models\Warranty;
use App\Services\StorefrontCache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

/**
 * Tells the Next storefront which cached data changed (see StorefrontCache).
 * Listens to Eloquent events only: models are not modified.
 */
class StorefrontCacheServiceProvider extends ServiceProvider
{
    /** Model => storefront cache tags it feeds. */
    public const MAP = [
        Product::class => ['catalog', 'merch'],
        Category::class => ['catalog', 'merch'],
        Badge::class => ['catalog', 'merch'],
        Attribute::class => ['catalog', 'merch'],
        Warranty::class => ['catalog', 'merch'],
        Promotion::class => ['catalog'],
        Bundle::class => ['merch'],
        Popup::class => ['merch'],
        ShippingCity::class => ['merch'],
        FeeRule::class => ['merch'],
        ContentPage::class => ['content', 'home'],
        LandingPage::class => ['landings'],
        SiteMenu::class => ['site'],
        Setting::class => ['site'],
        Redirect::class => ['redirects'],
    ];

    /** SystemConfig name => tags. "shop" holds the global price switch: every public payload depends on it. */
    public const CONFIG = [
        'shop' => StorefrontCache::TAGS,
        'theme' => ['site', 'config'],
        'social' => ['site', 'config'],
        'seo' => ['config'],
        'integrations' => ['config'],
    ];

    public function register(): void
    {
        $this->app->singleton(StorefrontCache::class);
    }

    public function boot(): void
    {
        foreach (self::MAP as $model => $tags) {
            foreach (['saved', 'deleted'] as $event) {
                Event::listen("eloquent.{$event}: {$model}", fn (Model $m) => app(StorefrontCache::class)->touch($tags));
            }
        }
        foreach (['saved', 'deleted'] as $event) {
            Event::listen("eloquent.{$event}: ".SystemConfig::class, function (SystemConfig $config) {
                app(StorefrontCache::class)->touch(self::CONFIG[$config->name] ?? []);
            });
        }
    }
}
