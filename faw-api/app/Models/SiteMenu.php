<?php

namespace App\Models;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Storefront menu (header, footer columns). Items: [{label, url, newTab, highlight}], in display order.
 * Links are internal (/...), https://, tel: or mailto: only.
 */
class SiteMenu extends ShopModel
{
    protected $table = 'SiteMenu';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['items' => 'array', 'active' => 'boolean'];

    /** @var array<string, string> */
    public const LOCATIONS = [
        'header' => 'En-tête : menu principal',
        'footer_shop' => 'Pied de page : colonne Boutique',
        'footer_info' => 'Pied de page : colonne Informations',
        'footer_legal' => 'Pied de page : liens légaux (bas de page)',
    ];

    public const MAX_ITEMS = 12;

    public const LINK = '#^(?:/(?!/)[^<>\s\\\\]*|https://[^<>\s\\\\]+|tel:\+?[0-9 ]{6,20}|mailto:[^<>\s@\\\\]+@[^<>\s@\\\\]+)$#';

    protected static function booted(): void
    {
        parent::booted();
        static::saving(function (SiteMenu $m) {
            if (! isset(self::LOCATIONS[$m->location])) {
                throw ValidationException::withMessages(['location' => 'Emplacement inconnu.']);
            }
            $m->title = trim((string) $m->title);
            $m->items = self::normalizeItems($m->items ?? []);
        });
    }

    /**
     * Items in display order. A header item may hold one level of sub-links ("children", shown as a dropdown).
     *
     * @return list<array{label: string, url: string, newTab: bool, highlight: bool, children?: list<array<string, mixed>>}>
     */
    public static function normalizeItems(mixed $raw, bool $nested = false): array
    {
        $items = is_string($raw) ? json_decode($raw, true) : $raw;
        if (! is_array($items)) {
            return [];
        }
        $items = array_values(array_filter($items, 'is_array'));
        if (count($items) > self::MAX_ITEMS) {
            throw ValidationException::withMessages(['items' => self::MAX_ITEMS.' liens maximum par menu.']);
        }
        $out = [];
        foreach ($items as $item) {
            $row = [
                'label' => trim((string) ($item['label'] ?? '')),
                'label_ar' => trim((string) ($item['label_ar'] ?? '')),
                'url' => trim((string) ($item['url'] ?? '')),
                'newTab' => (bool) ($item['newTab'] ?? false),
                'highlight' => (bool) ($item['highlight'] ?? false),
            ];
            Validator::make($row, [
                'label' => 'required|string|max:60',
                'label_ar' => 'nullable|string|max:60',
                'url' => ['required', 'string', 'max:500', 'regex:'.self::LINK],
            ], [
                'url.regex' => 'Lien interne commençant par /, adresse https://, tel: ou mailto:.',
            ])->validate();
            $row = array_filter($row, fn ($val, $k) => $k !== 'label_ar' || ($val !== '' && $val !== null), ARRAY_FILTER_USE_BOTH);
            if (! $nested && ! empty($item['children']) && is_array($item['children'])) {
                $children = self::normalizeItems($item['children'], true);
                if ($children !== []) {
                    $row['children'] = $children;
                }
            }
            $out[] = $row;
        }

        return $out;
    }
}
