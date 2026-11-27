<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * On-demand revalidation of the Next storefront cache.
 *
 * Model changes made in Filament (products, categories, content, menus, settings...) mark cache tags;
 * once the request is finished, one POST is sent to the storefront (SHOP_REVALIDATE_URL) with the
 * shared secret in the "x-faw-revalidate-secret" header. Nothing is sent when the URL or the secret is
 * not configured (local dev without the shop, tests): the shop then refreshes on its normal TTL.
 */
final class StorefrontCache
{
    /** Tags understood by the storefront (faw-shop/src/lib/shop-api.ts, TAGS). */
    public const TAGS = ['catalog', 'merch', 'content', 'home', 'site', 'config', 'landings', 'redirects'];

    /** @var array<string, true> */
    private array $pending = [];

    private bool $scheduled = false;

    /** @param  list<string>  $tags */
    public function touch(array $tags): void
    {
        foreach ($tags as $tag) {
            if (in_array($tag, self::TAGS, true)) {
                $this->pending[$tag] = true;
            }
        }
        if ($this->pending !== [] && ! $this->scheduled && self::configured()) {
            $this->scheduled = true;
            // After the response: the back office never waits for the storefront.
            app()->terminating(fn () => $this->flush());
        }
    }

    /** @return list<string> */
    public function pending(): array
    {
        return array_keys($this->pending);
    }

    public static function configured(): bool
    {
        return filled(config('services.storefront.revalidate_url')) && strlen((string) config('services.storefront.revalidate_secret')) >= 32;
    }

    /** Sends the pending tags (one request). Failures are logged, never thrown. */
    public function flush(): bool
    {
        $tags = $this->pending();
        $this->pending = [];
        $this->scheduled = false;
        if ($tags === [] || ! self::configured()) {
            return false;
        }
        try {
            $response = Http::timeout(3)->connectTimeout(2)->acceptJson()
                ->withHeaders(['x-faw-revalidate-secret' => (string) config('services.storefront.revalidate_secret')])
                ->post((string) config('services.storefront.revalidate_url'), ['tags' => $tags]);
            if (! $response->successful()) {
                Log::warning('Storefront revalidation refused', ['status' => $response->status(), 'tags' => $tags]);
            }

            return $response->successful();
        } catch (\Throwable $e) {
            Log::warning('Storefront revalidation failed', ['error' => $e->getMessage(), 'tags' => $tags]);

            return false;
        }
    }
}
