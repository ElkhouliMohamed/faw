<?php

namespace App\Services;

use App\Models\Product;
use App\Models\SystemConfig;

/**
 * What the public site may show. The global « Afficher les prix » setting is the master switch: when it is off,
 * every product is in quote mode. When it is on, each product follows its own mode (Product::SALES_MODES).
 */
class PriceVisibility
{
    public static function showOnSite(): bool
    {
        return (bool) (SystemConfig::settings('shop')['showPrices'] ?? false);
    }

    /** Quote mode for this product on the public site: no price sent, no online purchase. */
    public static function quoteOnly(Product $p): bool
    {
        return ! self::showOnSite() || $p->salesMode === 'quote_only' || (int) $p->price <= 0 || (bool) $p->priceToConfirm;
    }

    /** Public price mode: « online » (price + cart + checkout) or « quote » (« Demander un devis »). */
    public static function mode(Product $p): string
    {
        return self::quoteOnly($p) ? 'quote' : 'online';
    }

    public static function orderable(Product $p, int $price): bool
    {
        $availability = $p->availability;
        if ($availability === 'en stock' && $p->stockQty !== null && $p->stockQty <= 0) {
            $availability = 'indisponible';
        }

        return (bool) $p->active && $price > 0 && in_array($availability, ['en stock', 'sur commande'], true);
    }

    public static function sanitizeText(?string $text, bool $force = false): ?string
    {
        if ($text === null || $text === '' || (! $force && self::showOnSite())) {
            return $text;
        }
        $out = preg_replace('/(?:prix(?:\s+ttc)?)?\s*[:\-]?\s*\d(?:[\d\s\x{00A0}\x{202F}]|\d)*(?:[.,]\d+)?\s*(?:DH|MAD)(?:\s*TTC)?/iu', 'Prix sur devis', $text) ?? $text;
        $out = preg_replace('/(?:\s*Prix sur devis){2,}/u', ' Prix sur devis', $out) ?? $out;

        return trim(preg_replace('/[ ]{2,}/', ' ', $out) ?? $out);
    }

    /**
     * Public product row: prices are removed (and price mentions in texts replaced) when prices are hidden globally
     * or the product is « sur devis ».
     *
     * @param  array<string, mixed>  $row  must carry priceMode (see StoreController::publicProduct)
     */
    public static function sanitizeProduct(array $row): array
    {
        if (self::showOnSite() && ($row['priceMode'] ?? 'quote') === 'online') {
            return $row;
        }
        unset($row['price'], $row['basePrice'], $row['compareAt'], $row['promoName']);
        foreach (['description', 'shortDescription', 'seoTitle', 'metaTitle', 'metaDescription', 'details'] as $field) {
            if (isset($row[$field]) && is_string($row[$field])) {
                $row[$field] = self::sanitizeText($row[$field], true);
            }
        }

        return $row;
    }
}
