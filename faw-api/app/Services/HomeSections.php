<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Home page sections edited in Filament (Homepages resource, Builder field).
 *
 * Stored on ContentPage(kind = home).blocks in the Filament Builder shape:
 *   [{type: "hero", data: {enabled: true, title: "...", ...}}, ...]
 * The older flat format ({type: "text", title: "...", body: "..."}) is still accepted and converted.
 * Only whitelisted keys are kept, links are internal (/...) or https://, images are local paths.
 */
final class HomeSections
{
    public const MAX = 30;

    /** @var array<string, string> */
    public const TYPES = [
        'hero' => 'Bannière principale',
        'categories' => 'Catégories mises en avant',
        'products' => 'Produits mis en avant',
        'usps' => 'Pourquoi FAW (arguments)',
        'references' => 'Références / logos clients',
        'testimonials' => 'Témoignages',
        'cta' => 'Appel à action (devis)',
        'blog' => 'Derniers articles du blog',
        'text' => 'Texte libre',
        'faq' => 'Questions fréquentes',
    ];

    /** @var array<string, string> */
    public const ICONS = [
        'truck' => 'Livraison',
        'warehouse' => 'Dépôt / stock',
        'shield' => 'Garantie / sécurité',
        'flame' => 'Incendie',
        'badge' => 'Qualité / certification',
        'file' => 'Devis',
        'clock' => 'Délais',
        'wrench' => 'Installation / SAV',
        'building' => 'Entreprises / chantiers',
        'phone' => 'Contact',
    ];

    public const LINK = '#^(?:/(?!/)[^<>\\\\\s]*|https://[^<>\\\\\s]+)$#';

    public const IMAGE = '#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$#i';

    /** Scalar fields per type => max length ('bool' / 'int' for the other kinds). */
    private const FIELDS = [
        'hero' => ['eyebrow' => 80, 'title' => 140, 'subtitle' => 400, 'image' => 500, 'imageAlt' => 160, 'primaryLabel' => 40, 'primaryUrl' => 500, 'secondaryLabel' => 60, 'secondaryUrl' => 500, 'showContact' => 'bool'],
        'categories' => ['title' => 120, 'subtitle' => 300],
        'products' => ['title' => 120, 'subtitle' => 300, 'linkLabel' => 40, 'linkUrl' => 500],
        'usps' => ['title' => 120, 'subtitle' => 300],
        'references' => ['title' => 120, 'subtitle' => 300],
        'testimonials' => ['title' => 120, 'subtitle' => 300],
        'cta' => ['title' => 120, 'text' => 400, 'label' => 40, 'url' => 500, 'showWhatsapp' => 'bool'],
        'blog' => ['title' => 120, 'count' => 'int'],
        'text' => ['title' => 120, 'body' => 8000],
        'faq' => ['title' => 120],
    ];

    /** List fields per type => [max items, item fields => max length]. */
    private const LISTS = [
        'categories' => ['slugs' => [12, null]],
        'products' => ['ids' => [12, null]],
        'usps' => ['items' => [8, ['icon' => 20, 'title' => 80, 'text' => 300]]],
        'references' => ['logos' => [24, ['name' => 80, 'image' => 500, 'url' => 500]]],
        'testimonials' => ['items' => [12, ['quote' => 600, 'author' => 80, 'role' => 120]]],
        'faq' => ['items' => [30, ['q' => 200, 'a' => 1500]]],
    ];

    private const REQUIRED = [
        'hero' => ['title'],
        'cta' => ['title', 'label', 'url'],
        'text' => ['body'],
    ];

    private const ITEM_REQUIRED = [
        'usps' => ['title'],
        'references' => ['name', 'image'],
        'testimonials' => ['quote', 'author'],
        'faq' => ['q', 'a'],
    ];

    /** Legacy flat landing-page blocks => home section data. */
    private const LEGACY = [
        'hero' => ['ctaLabel' => 'primaryLabel', 'ctaUrl' => 'primaryUrl'],
    ];

    /**
     * Validate and normalise to the stored Builder shape.
     *
     * @return list<array{type: string, data: array<string, mixed>}>
     */
    public static function normalize(mixed $raw): array
    {
        $sections = is_string($raw) ? json_decode($raw, true) : $raw;
        if ($sections === null) {
            return [];
        }
        if (! is_array($sections) || count($sections) > self::MAX) {
            throw ValidationException::withMessages(['blocks' => 'Maximum '.self::MAX.' sections.']);
        }
        $out = [];
        foreach (array_values($sections) as $section) {
            if (! is_array($section)) {
                throw ValidationException::withMessages(['blocks' => 'Section invalide.']);
            }
            $out[] = self::section($section);
        }

        return $out;
    }

    /**
     * Enabled sections, flattened for the storefront API: [{type, ...data}] without the "enabled" flag.
     *
     * @return list<array<string, mixed>>
     */
    public static function public(mixed $stored): array
    {
        try {
            $sections = self::normalize($stored);
        } catch (ValidationException) {
            return [];
        }

        $out = [];
        foreach ($sections as $s) {
            if (! ($s['data']['enabled'] ?? true)) {
                continue;
            }
            $data = $s['data'];
            unset($data['enabled']);
            $out[] = ['type' => $s['type']] + $data;
        }

        return $out;
    }

    /** True when the stored value still uses the flat landing-page format (home created before the section builder). */
    public static function isLegacy(mixed $stored): bool
    {
        $sections = is_string($stored) ? json_decode($stored, true) : $stored;
        if (! is_array($sections) || $sections === []) {
            return false;
        }
        foreach ($sections as $s) {
            if (is_array($s) && array_key_exists('data', $s)) {
                return false;
            }
        }

        return true;
    }

    /** @return array{type: string, data: array<string, mixed>} */
    private static function section(array $section): array
    {
        $type = (string) ($section['type'] ?? '');
        if (! isset(self::FIELDS[$type])) {
            throw ValidationException::withMessages(['blocks' => 'Type de section invalide.']);
        }
        if (isset($section['data']) && is_array($section['data'])) {
            $in = $section['data'];
        } else {
            // Legacy flat block: every key but "type" is data; rename the landing-page keys.
            $in = $section;
            unset($in['type']);
            foreach (self::LEGACY[$type] ?? [] as $from => $to) {
                if (array_key_exists($from, $in) && ! array_key_exists($to, $in)) {
                    $in[$to] = $in[$from];
                }
            }
        }

        $data = ['enabled' => ! array_key_exists('enabled', $in) || (bool) $in['enabled']];
        $rules = [];
        foreach (self::FIELDS[$type] as $key => $max) {
            if ($max === 'bool') {
                $data[$key] = (bool) ($in[$key] ?? ($key === 'showContact' || $key === 'showWhatsapp'));

                continue;
            }
            if ($max === 'int') {
                $data[$key] = max(1, min(6, (int) ($in[$key] ?? 3)));

                continue;
            }
            $data[$key] = trim((string) ($in[$key] ?? ''));
            $rules[$key] = ['string', 'max:'.$max];
            if (str_ends_with($key, 'Url') || $key === 'url') {
                $rules[$key] = ['nullable', 'string', 'max:500', 'regex:'.self::LINK];
            }
            if ($key === 'image') {
                $rules[$key] = ['nullable', 'string', 'max:500', 'regex:'.self::IMAGE];
            }
        }
        foreach (self::REQUIRED[$type] ?? [] as $key) {
            $rules[$key] = array_merge(['required'], array_diff((array) $rules[$key], ['nullable']));
        }

        foreach (self::LISTS[$type] ?? [] as $key => [$maxItems, $itemFields]) {
            $list = array_values(array_filter((array) ($in[$key] ?? []), fn ($v) => $v !== null && $v !== ''));
            if (count($list) > $maxItems) {
                throw ValidationException::withMessages(['blocks' => "Section « ".self::TYPES[$type]." » : {$maxItems} éléments maximum."]);
            }
            if ($itemFields === null) {
                $data[$key] = array_values(array_unique(array_map(fn ($v) => substr(trim((string) $v), 0, 160), array_filter($list, 'is_scalar'))));

                continue;
            }
            $items = [];
            foreach ($list as $item) {
                if (! is_array($item)) {
                    continue;
                }
                $row = [];
                foreach ($itemFields as $field => $max) {
                    $row[$field] = trim((string) ($item[$field] ?? ''));
                }
                $itemRules = array_map(fn ($max) => ['string', 'max:'.$max], $itemFields);
                foreach (self::ITEM_REQUIRED[$type] ?? [] as $field) {
                    $itemRules[$field][] = 'required';
                }
                if ($type === 'references') {
                    $itemRules['image'][] = 'regex:'.self::IMAGE;
                    $itemRules['url'][] = 'regex:'.self::LINK;
                }
                if ($type === 'usps' && ! isset(self::ICONS[$row['icon']])) {
                    $row['icon'] = 'badge';
                }
                Validator::make($row, self::nullableStrings($itemRules))->validate();
                $items[] = $row;
            }
            $data[$key] = $items;
        }

        Validator::make($data, self::nullableStrings($rules))->validate();

        return ['type' => $type, 'data' => $data];
    }

    /** Empty strings are allowed for optional fields ("string" alone rejects them once ConvertEmptyStringsToNull is bypassed). */
    private static function nullableStrings(array $rules): array
    {
        foreach ($rules as $key => $r) {
            $r = (array) $r;
            if (! in_array('required', $r, true) && ! in_array('nullable', $r, true)) {
                array_unshift($r, 'nullable');
            }
            $rules[$key] = $r;
        }

        return $rules;
    }
}
