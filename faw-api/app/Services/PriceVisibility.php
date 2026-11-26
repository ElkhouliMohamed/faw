<?php

namespace App\Services;

use App\Models\Product;
use App\Models\SystemConfig;

class PriceVisibility
{
    public static function showOnSite(): bool
    {
        return (bool) (SystemConfig::settings('shop')['showPrices'] ?? false);
    }

    public static function orderable(Product $p, int $price): bool
    {
        $availability = $p->availability;
        if ($availability === 'en stock' && $p->stockQty !== null && $p->stockQty <= 0) {
            $availability = 'indisponible';
        }

        return (bool) $p->active && $price > 0 && in_array($availability, ['en stock', 'sur commande'], true);
    }


    public static function sanitizeText(?string $text): ?string
    {
        if ($text === null || $text === '' || self::showOnSite()) {
            return $text;
        }
        $out = preg_replace('/(?:prix(?:\s+ttc)?)?\s*[:\-]?\s*\d(?:[\d\s\x{00A0}\x{202F}]|\d)*(?:[.,]\d+)?\s*(?:DH|MAD)(?:\s*TTC)?/iu', 'Prix sur devis', $text) ?? $text;
        $out = preg_replace('/(?:\s*Prix sur devis){2,}/u', ' Prix sur devis', $out) ?? $out;

        return trim(preg_replace('/[ ]{2,}/', ' ', $out) ?? $out);
    }

    /** @param  array<string, mixed>  $row */
    public static function sanitizeProduct(array $row): array
    {
        if (self::showOnSite()) {
            return $row;
        }
        unset($row['price'], $row['basePrice'], $row['compareAt'], $row['promoName']);
        foreach (['description', 'shortDescription', 'seoTitle', 'metaTitle', 'metaDescription', 'details'] as $field) {
            if (isset($row[$field]) && is_string($row[$field])) {
                $row[$field] = self::sanitizeText($row[$field]);
            }
        }

        return $row;
    }
}
