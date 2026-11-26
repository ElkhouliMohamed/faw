<?php

namespace App\Http\Controllers;

use App\Models\SystemConfig;
use App\Services\PriceVisibility;

class PublicConfigController extends Controller
{
    public function __invoke()
    {
        $theme = SystemConfig::settings('theme');
        $shop = SystemConfig::settings('shop');
        $marketing = SystemConfig::settings('integrations');
        $social = SystemConfig::settings('social');
        $seo = SystemConfig::settings('seo');
        $valid = fn ($value, $regex) => is_string($value) && preg_match($regex, $value) ? $value : null;

        return response()->json([
            'shop' => ['showPrices' => (bool) ($shop['showPrices'] ?? false)],
            'theme' => ['mode' => in_array($theme['mode'] ?? '', ['light', 'dark']) ? $theme['mode'] : 'light', 'accent' => in_array($theme['accent'] ?? '', ['copper', 'olive', 'umber']) ? $theme['accent'] : 'copper'],
            'integrations' => ['pixelEnabled' => (bool) ($marketing['pixelEnabled'] ?? false), 'pixelId' => $valid($marketing['pixelId'] ?? null, '/^\d{5,20}$/'), 'gaEnabled' => (bool) ($marketing['gaEnabled'] ?? false), 'gaId' => $valid($marketing['gaId'] ?? null, '/^G-[A-Z0-9]{4,20}$/'), 'adsEnabled' => (bool) ($marketing['adsEnabled'] ?? false), 'adsId' => $valid($marketing['adsId'] ?? null, '/^AW-\d{5,20}$/'), 'adsLabel' => $valid($marketing['adsLabel'] ?? null, '/^[A-Za-z0-9_-]{1,100}$/'), 'gscVerification' => $valid($marketing['gscVerification'] ?? null, '/^[\w-]{10,100}$/')],
            'social' => ['floatingEnabled' => (bool) ($social['floatingEnabled'] ?? true), 'channel' => in_array($social['channel'] ?? '', ['whatsapp', 'instagram', 'linkedin']) ? $social['channel'] : 'whatsapp', 'whatsappNumber' => $valid($social['whatsappNumber'] ?? null, '/^\d{8,20}$/'), 'instagram' => $valid($social['instagram'] ?? null, '#^https://(?:www\.)?instagram\.com/[^<>\\\\]*$#i'), 'linkedin' => $valid($social['linkedin'] ?? null, '#^https://(?:www\.)?linkedin\.com/[^<>\\\\]*$#i'), 'facebook' => $valid($social['facebook'] ?? null, '#^https://(?:www\.)?facebook\.com/[^<>\\\\]*$#i')],
            'seo' => ['titleTemplate' => $seo['titleTemplate'] ?? '%s | FAW Aluminium', 'description' => PriceVisibility::showOnSite() ? ($seo['description'] ?? null) : PriceVisibility::sanitizeText($seo['description'] ?? null), 'ogImage' => $valid($seo['ogImage'] ?? null, '#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif)$#i'), 'canonicalBase' => $valid($seo['canonicalBase'] ?? null, '#^https://[a-zA-Z0-9.-]+(?::\d+)?/?$#'), 'noindex' => (bool) ($seo['noindex'] ?? true), 'sitemapEnabled' => (bool) ($seo['sitemapEnabled'] ?? true)],
        ])->header('Cache-Control','no-store');
    }
}
