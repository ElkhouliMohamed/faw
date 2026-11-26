<?php

namespace App\Http\Controllers;

use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\ContentPage;
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
        }if ($r->filled('tag')) {
            $tag = BlogTag::where('active', true)->where('slug', $r->query('tag'))->first();
            $q->whereJsonContains('tags', (string) ($tag?->id ?? -1));
        }

        $page = $q->orderByDesc('publishedAt')->orderByDesc('id')->paginate(20, $this->fields());
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
