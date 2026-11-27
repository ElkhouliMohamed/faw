<?php

namespace App\Http\Controllers;

use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\ContentPage;
use App\Models\Setting;
use App\Models\SiteMenu;
use App\Models\SystemConfig;
use App\Services\HomeSections;
use App\Services\PriceVisibility;
use Illuminate\Http\Request;

class ContentController extends Controller
{
    protected function published()
    {
        return ContentPage::where('published', true)->where(fn ($q) => $q->whereNull('publishedAt')->orWhere('publishedAt', '<=', now()));
    }

    protected function fields(): array
    {
        return ['kind', 'slug', 'title', 'excerpt', 'bodyHtml', 'blocks', 'image', 'seoTitle', 'seoDescription', 'publishedAt', 'updated_at', 'tags', 'categoryId', 'featuredProductId', 'ctaLabel', 'ctaUrl', 'defaultSections'];
    }

    public function show(string $kind, string $slug)
    {
        abort_unless(in_array($kind, ['home', 'page', 'technology', 'blog']), 404);

        return response()->json($this->publicPage($this->published()->where('kind', $kind)->where('slug', $slug)->firstOrFail()->only($this->fields())))->header('Cache-Control', 'no-store');
    }

    public function posts(Request $r)
    {
        $q = $this->published()->where('kind', 'blog');
        if ($r->filled('category')) {
            $category = BlogCategory::where('active', true)->where('slug', $r->query('category'))->first();
            $q->where('categoryId', $category?->id ?? -1);
        }
        if ($r->filled('tag')) {
            $tag = BlogTag::where('active', true)->where('slug', $r->query('tag'))->first();
            $q->whereJsonContains('tags', (string) ($tag?->id ?? -1));
        }

        // Newest first, posts without a publication date last. PostgreSQL sorts NULL first on DESC, SQLite/MySQL last:
        // "IS NULL" (false before true) makes it the same everywhere without vendor-specific NULLS LAST syntax.
        $publishedAt = $q->getQuery()->getGrammar()->wrap('publishedAt');
        $page = $q->orderByRaw("CASE WHEN {$publishedAt} IS NULL THEN 1 ELSE 0 END")->orderByDesc('publishedAt')->orderByDesc('id')->paginate(20, $this->fields());
        $page->getCollection()->transform(function ($row) {
            return $this->publicPage(is_array($row) ? $row : $row->only($this->fields()));
        });

        return $page;
    }

    public function links()
    {
        return $this->published()->whereIn('kind', ['page', 'technology', 'blog'])->get(['kind', 'slug', 'updated_at']);
    }

    public function taxonomies()
    {
        return ['categories' => BlogCategory::where('active', true)->get(['id', 'slug', 'label']), 'tags' => BlogTag::where('active', true)->get(['id', 'slug', 'label'])];
    }

    /**
     * Site-wide content for the storefront layout: contact details, social links, theme overrides and menus.
     * Every value is validated here; a null value / null menu means "use the storefront default".
     */
    public function site()
    {
        $social = SystemConfig::settings('social');
        $theme = SystemConfig::settings('theme');
        $settings = Setting::query()->whereIn('key', ['phone', 'email', 'office_address', 'depot_address'])->pluck('value', 'key');
        $text = fn ($v, int $max = 200) => is_string($v) && trim($v) !== '' && ! preg_match('/[<>]/', $v) ? mb_substr(trim($v), 0, $max) : null;
        $match = fn ($v, string $re) => is_string($v) && preg_match($re, trim($v)) ? trim($v) : null;
        $image = '#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|avif)$#i';

        $phone = $match($social['phone'] ?? null, '/^\+?[0-9][0-9 .()-]{5,24}$/') ?? $match($settings['phone'] ?? null, '/^\+?[0-9][0-9 .()-]{5,24}$/');
        $whatsapp = $match($social['whatsappNumber'] ?? null, '/^\d{8,20}$/');
        $email = filter_var($social['email'] ?? null, FILTER_VALIDATE_EMAIL) ?: (filter_var($settings['email'] ?? null, FILTER_VALIDATE_EMAIL) ?: null);

        $menus = [];
        foreach (array_keys(SiteMenu::LOCATIONS) as $location) {
            $menus[$location] = null;
        }
        foreach (SiteMenu::where('active', true)->get() as $menu) {
            try {
                $items = SiteMenu::normalizeItems($menu->items);
            } catch (\Throwable) {
                $items = [];
            }
            if ($items !== []) {
                $menus[$menu->location] = ['title' => $this->clean((string) $menu->title), 'items' => array_map(fn ($i) => ['label' => $this->clean($i['label'])] + $i, $items)];
            }
        }

        return response()->json([
            'contact' => [
                'phone' => $phone,
                'whatsappNumber' => $whatsapp,
                'email' => $email,
                'address' => $text($social['address'] ?? null) ?? $text($settings['office_address'] ?? null),
                'depotAddress' => $text($social['depotAddress'] ?? null) ?? $text($settings['depot_address'] ?? null),
                'hours' => $text($social['hours'] ?? null),
                'mapsUrl' => $match($social['mapsUrl'] ?? null, '#^https://[^<>\s"\\\\]+$#'),
                'wazeUrl' => $match($social['wazeUrl'] ?? null, '#^https://[^<>\s"\\\\]+$#'),
            ],
            'socials' => [
                'instagram' => $match($social['instagram'] ?? null, '#^https://(?:www\.)?instagram\.com/[^<>\s"\\\\]*$#i'),
                'linkedin' => $match($social['linkedin'] ?? null, '#^https://(?:[a-z]{2,3}\.)?linkedin\.com/[^<>\s"\\\\]*$#i'),
                'facebook' => $match($social['facebook'] ?? null, '#^https://(?:www\.)?facebook\.com/[^<>\s"\\\\]*$#i'),
            ],
            'theme' => [
                'primaryColor' => $match($theme['primaryColor'] ?? null, '/^#[0-9a-fA-F]{6}$/'),
                'logo' => $match($theme['logo'] ?? null, $image),
                'logoDark' => $match($theme['logoDark'] ?? null, $image),
            ],
            'menus' => $menus,
        ])->header('Cache-Control', 'no-store');
    }

    /** {home: sections of the published home record} or {home: null}: the storefront then renders its default home. */
    public function home()
    {
        $page = $this->published()->where('kind', 'home')->orderBy('id')->first();
        if (! $page) {
            return response()->json(['home' => null])->header('Cache-Control', 'no-store');
        }
        $sections = HomeSections::public($page->getAttributes()['blocks'] ?? '[]');
        $show = PriceVisibility::showOnSite();

        return response()->json(['home' => [
            'title' => $this->clean((string) $page->title),
            'excerpt' => $page->excerpt !== null ? $this->clean($page->excerpt) : null,
            'image' => is_string($page->image) && preg_match(HomeSections::IMAGE, $page->image) ? $page->image : null,
            'ctaLabel' => $page->ctaLabel !== null ? $this->clean($page->ctaLabel) : null,
            'ctaUrl' => is_string($page->ctaUrl) && preg_match(HomeSections::LINK, $page->ctaUrl) ? $page->ctaUrl : null,
            'seoTitle' => $page->seoTitle !== null ? $this->clean($page->seoTitle) : null,
            'seoDescription' => $page->seoDescription !== null ? $this->clean($page->seoDescription) : null,
            'legacy' => HomeSections::isLegacy($page->getAttributes()['blocks'] ?? '[]'),
            'defaultSections' => (bool) $page->defaultSections,
            'sections' => $show ? $sections : $this->sanitizeBlocks($sections),
            'updatedAt' => $page->updated_at?->toIso8601String(),
        ]])->header('Cache-Control', 'no-store');
    }

    /** Public text with prices masked when the owner hides prices on the site. */
    protected function clean(string $text): string
    {
        return (string) PriceVisibility::sanitizeText($text);
    }

    /** @param  array<string, mixed>  $row */
    protected function publicPage(array $row): array
    {
        if (PriceVisibility::showOnSite()) {
            return $row;
        }
        foreach (['title', 'excerpt', 'bodyHtml', 'seoTitle', 'seoDescription', 'ctaLabel'] as $field) {
            if (isset($row[$field]) && is_string($row[$field])) {
                $row[$field] = PriceVisibility::sanitizeText($row[$field]);
            }
        }
        if (isset($row['blocks']) && is_string($row['blocks'])) {
            $decoded = json_decode($row['blocks'], true);
            if (is_array($decoded)) {
                $row['blocks'] = json_encode($this->sanitizeBlocks($decoded), JSON_UNESCAPED_UNICODE);
            }
        } elseif (isset($row['blocks']) && is_array($row['blocks'])) {
            $row['blocks'] = $this->sanitizeBlocks($row['blocks']);
        }

        return $row;
    }

    /** @param  array<int|string, mixed>  $blocks */
    protected function sanitizeBlocks(array $blocks): array
    {
        foreach ($blocks as $i => $block) {
            if (! is_array($block)) {
                continue;
            }
            foreach ($block as $k => $v) {
                if (is_string($v)) {
                    $blocks[$i][$k] = PriceVisibility::sanitizeText($v);
                } elseif (is_array($v)) {
                    $blocks[$i][$k] = $this->sanitizeBlocks($v);
                }
            }
        }

        return $blocks;
    }
}
