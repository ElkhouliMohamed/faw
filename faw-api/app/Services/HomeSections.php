<?php

namespace App\Services;

use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Home page sections edited in Filament (Homepages resource, Builder field).
 *
 * Stored on ContentPage(kind = home).blocks in the Filament Builder shape:
 *   [{type: "heroSlider", data: {enabled: true, slides: [...], ...}}, ...]
 * The older flat format ({type: "text", title: "...", body: "..."}) is still accepted and converted.
 * Only whitelisted keys are kept, links are internal (/...) or https://, images are local paths, icons come from ICONS.
 *
 * Every French text field may have an "_ar" twin: the public payload uses it in Arabic and falls back to French.
 */
final class HomeSections
{
    public const MAX = 30;

    /** @var array<string, string> */
    public const TYPES = [
        'heroSlider' => 'Bannière défilante (slider)',
        'features' => 'Bandeau d’atouts (icônes)',
        'products' => 'Produits',
        'sectors' => 'Solutions par secteur',
        'about' => 'À propos',
        'highlights' => 'Bandeau « Pourquoi nous choisir »',
        'projects' => 'Réalisations',
        'process' => 'Processus (étapes)',
        'cta' => 'Appel à action (contact / devis)',
        'hero' => 'Bannière simple (ancienne)',
        'categories' => 'Catégories mises en avant',
        'usps' => 'Pourquoi FAW (arguments)',
        'references' => 'Références / logos clients',
        'testimonials' => 'Témoignages',
        'blog' => 'Derniers articles du blog',
        'text' => 'Texte libre',
        'faq' => 'Questions fréquentes',
    ];

    /**
     * Icons offered in Filament (lucide icon names, rendered by name in the storefront).
     *
     * @var array<string, string>
     */
    public const ICONS = [
        'flame' => 'Flamme / feu',
        'fire-extinguisher' => 'Extincteur',
        'siren' => 'Alarme',
        'shield-check' => 'Bouclier validé (sécurité)',
        'lock' => 'Cadenas',
        'badge-check' => 'Badge certifié',
        'award' => 'Médaille / certification',
        'gem' => 'Diamant (qualité)',
        'star' => 'Étoile',
        'thumbs-up' => 'Pouce levé (satisfaction)',
        'check-circle' => 'Coche dans un cercle',
        'check' => 'Coche',
        'ruler' => 'Règle (sur-mesure)',
        'sliders-horizontal' => 'Réglages (options)',
        'settings' => 'Engrenage (adaptable)',
        'wrench' => 'Clé (installation / SAV)',
        'hammer' => 'Marteau (travaux)',
        'hard-hat' => 'Casque de chantier',
        'door-open' => 'Porte ouverte',
        'door-closed' => 'Porte fermée',
        'truck' => 'Camion (livraison)',
        'package' => 'Colis',
        'warehouse' => 'Entrepôt / dépôt',
        'building-2' => 'Bureaux / tertiaire',
        'building' => 'Immeuble / résidentiel',
        'factory' => 'Usine / industrie',
        'hospital' => 'Hôpital / santé',
        'landmark' => 'Bâtiment public',
        'school' => 'École',
        'hotel' => 'Hôtel',
        'store' => 'Commerce',
        'house' => 'Maison',
        'headset' => 'Casque (support)',
        'phone' => 'Téléphone',
        'message-circle' => 'Bulle (message)',
        'mail' => 'Enveloppe (e-mail)',
        'file-text' => 'Document (devis)',
        'clipboard-check' => 'Presse-papiers validé (étude)',
        'clock' => 'Horloge (délais)',
        'calendar' => 'Calendrier',
        'map-pin' => 'Repère (adresse)',
        'globe' => 'Globe (Europe / international)',
        'users' => 'Équipe',
        'handshake' => 'Poignée de main',
        'leaf' => 'Feuille (environnement)',
        'zap' => 'Éclair (rapidité)',
        'eye' => 'Œil (contrôle)',
        'thermometer' => 'Thermomètre',
    ];

    /** Icon keys used before the lucide list (usps section): mapped on read, never rejected. */
    public const LEGACY_ICONS = ['shield' => 'shield-check', 'badge' => 'badge-check', 'file' => 'file-text'];

    public const LINK = '#^(?:/(?!/)[^<>\\\\\s]*|https://[^<>\\\\\s]+)$#';

    public const IMAGE = '#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$#i';

    /** Folder (on the "public" disk) where the home page image uploads are stored. */
    public const UPLOAD_DIR = 'media/accueil';

    public const PHONE = '/^\+?[0-9][0-9 .()-]{5,24}$/';

    public const DIGITS = '/^\d{8,20}$/';

    public const ANCHOR = '/^[a-z0-9][a-z0-9-]{0,39}$/';

    /**
     * Scalar fields per type. A number is the max length of a text; otherwise a kind:
     * bool (default off), bool1 (default on), icon, image, link, anchor, phone, digits, int:min:max:default.
     */
    private const FIELDS = [
        'heroSlider' => ['autoplay' => 'bool1', 'interval' => 'int:3:15:6'],
        'features' => ['title' => 120, 'title_ar' => 120],
        'products' => ['anchor' => 'anchor', 'eyebrow' => 60, 'eyebrow_ar' => 60, 'title' => 120, 'title_ar' => 120, 'subtitle' => 300, 'subtitle_ar' => 300, 'linkLabel' => 40, 'linkLabel_ar' => 40, 'linkUrl' => 'link', 'category' => 160, 'count' => 'int:1:12:3'],
        'sectors' => ['anchor' => 'anchor', 'eyebrow' => 60, 'eyebrow_ar' => 60, 'title' => 120, 'title_ar' => 120, 'text' => 400, 'text_ar' => 400],
        'about' => ['anchor' => 'anchor', 'image' => 'image', 'imageAlt' => 160, 'imageAlt_ar' => 160, 'eyebrow' => 60, 'eyebrow_ar' => 60, 'title' => 120, 'title_ar' => 120, 'text' => 1200, 'text_ar' => 1200, 'buttonLabel' => 40, 'buttonLabel_ar' => 40, 'buttonUrl' => 'link'],
        'highlights' => ['title' => 120, 'title_ar' => 120, 'backgroundImage' => 'image'],
        'projects' => ['anchor' => 'anchor', 'eyebrow' => 60, 'eyebrow_ar' => 60, 'title' => 120, 'title_ar' => 120, 'linkLabel' => 40, 'linkLabel_ar' => 40, 'linkUrl' => 'link'],
        'process' => ['anchor' => 'anchor', 'eyebrow' => 60, 'eyebrow_ar' => 60, 'title' => 120, 'title_ar' => 120, 'text' => 400, 'text_ar' => 400],
        'cta' => ['title' => 120, 'title_ar' => 120, 'text' => 400, 'text_ar' => 400, 'label' => 40, 'label_ar' => 40, 'url' => 'link', 'showWhatsapp' => 'bool1', 'showPhone' => 'bool', 'phone' => 'phone', 'phoneLabel' => 40, 'phoneLabel_ar' => 40, 'whatsappNumber' => 'digits', 'whatsappLabel' => 40, 'whatsappLabel_ar' => 40, 'backgroundImage' => 'image'],
        'hero' => ['eyebrow' => 80, 'eyebrow_ar' => 80, 'title' => 140, 'title_ar' => 140, 'subtitle' => 400, 'subtitle_ar' => 400, 'image' => 'image', 'imageAlt' => 160, 'primaryLabel' => 40, 'primaryLabel_ar' => 40, 'primaryUrl' => 'link', 'secondaryLabel' => 60, 'secondaryLabel_ar' => 60, 'secondaryUrl' => 'link', 'showContact' => 'bool1'],
        'categories' => ['title' => 120, 'title_ar' => 120, 'subtitle' => 300, 'subtitle_ar' => 300],
        'usps' => ['title' => 120, 'title_ar' => 120, 'subtitle' => 300, 'subtitle_ar' => 300],
        'references' => ['title' => 120, 'title_ar' => 120, 'subtitle' => 300, 'subtitle_ar' => 300],
        'testimonials' => ['title' => 120, 'title_ar' => 120, 'subtitle' => 300, 'subtitle_ar' => 300],
        'blog' => ['title' => 120, 'title_ar' => 120, 'count' => 'int:1:6:3'],
        'text' => ['title' => 120, 'title_ar' => 120, 'body' => 8000, 'body_ar' => 8000],
        'faq' => ['title' => 120, 'title_ar' => 120],
    ];

    /** Badge / line lists reused by several types. */
    private const SLIDE = [
        'eyebrow' => 80, 'eyebrow_ar' => 80, 'title' => 140, 'title_ar' => 140, 'subtitle' => 400, 'subtitle_ar' => 400,
        'image' => 'image', 'imageAlt' => 160, 'imageAlt_ar' => 160, 'imageWhole' => 'bool',
        'primaryLabel' => 40, 'primaryLabel_ar' => 40, 'primaryUrl' => 'link',
        'secondaryLabel' => 40, 'secondaryLabel_ar' => 40, 'secondaryUrl' => 'link', 'secondaryWhatsapp' => 'bool',
        'highlightIcon' => 'icon',
        'highlights' => [6, ['text' => 30], ['text']],
        'badges' => [4, ['icon' => 'icon', 'line1' => 40, 'line1_ar' => 40, 'line2' => 40, 'line2_ar' => 40], ['line1']],
    ];

    /** List fields per type => [max items, item fields (null = list of ids/slugs), required item fields, min items]. */
    private const LISTS = [
        'heroSlider' => ['slides' => [6, self::SLIDE, ['title'], 1]],
        'features' => ['items' => [8, ['icon' => 'icon', 'title' => 60, 'title_ar' => 60, 'text' => 160, 'text_ar' => 160], ['title']]],
        'products' => [
            'ids' => [12, null],
            'cards' => [12, ['image' => 'image', 'imageAlt' => 160, 'title' => 80, 'title_ar' => 80, 'text' => 120, 'text_ar' => 120, 'url' => 'link'], ['title']],
        ],
        'sectors' => ['items' => [10, ['icon' => 'icon', 'label' => 60, 'label_ar' => 60, 'url' => 'link'], ['label']]],
        'about' => ['checklist' => [8, ['text' => 120, 'text_ar' => 120], ['text']]],
        'highlights' => ['items' => [6, ['icon' => 'icon', 'label' => 60, 'label_ar' => 60], ['label']]],
        'projects' => ['items' => [12, ['image' => 'image', 'title' => 80, 'title_ar' => 80, 'location' => 80, 'location_ar' => 80, 'url' => 'link'], ['title']]],
        'process' => ['steps' => [6, ['icon' => 'icon', 'title' => 60, 'title_ar' => 60, 'text' => 200, 'text_ar' => 200], ['title']]],
        'categories' => ['slugs' => [12, null]],
        'usps' => ['items' => [8, ['icon' => 'icon', 'title' => 80, 'title_ar' => 80, 'text' => 300, 'text_ar' => 300], ['title']]],
        'references' => ['logos' => [24, ['name' => 80, 'image' => 'image', 'url' => 'link'], ['name', 'image']]],
        'testimonials' => ['items' => [12, ['quote' => 600, 'quote_ar' => 600, 'author' => 80, 'role' => 120, 'role_ar' => 120], ['quote', 'author']]],
        'faq' => ['items' => [30, ['q' => 200, 'q_ar' => 200, 'a' => 1500, 'a_ar' => 1500], ['q', 'a']]],
    ];

    private const REQUIRED = [
        'hero' => ['title'],
        'cta' => ['title'],
        'text' => ['body'],
        'highlights' => ['title'],
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
     * Enabled sections, flattened for the storefront API: [{type, ...data}] without the "enabled" flag,
     * texts in the requested language (Arabic falls back to French), "_ar" keys removed.
     *
     * @return list<array<string, mixed>>
     */
    public static function public(mixed $stored, ?string $locale = null): array
    {
        try {
            $sections = self::normalize($stored);
        } catch (ValidationException) {
            return [];
        }

        $isAr = ($locale ?? \App\Support\LocaleHelper::current()) === 'ar';
        $out = [];
        foreach ($sections as $s) {
            if (! ($s['data']['enabled'] ?? true)) {
                continue;
            }
            $data = $s['data'];
            unset($data['enabled']);
            $out[] = ['type' => $s['type']] + self::localize($data, $isAr);
        }

        return $out;
    }

    /**
     * Replace each French value by its non-empty "_ar" twin (Arabic only) and drop the "_ar" keys, at any depth.
     *
     * @param  array<mixed>  $data
     * @return array<mixed>
     */
    public static function localize(array $data, bool $isAr): array
    {
        foreach ($data as $k => $v) {
            if (is_string($k) && str_ends_with($k, '_ar')) {
                $base = substr($k, 0, -3);
                if ($isAr && is_string($v) && trim($v) !== '') {
                    $data[$base] = $v;
                }
                unset($data[$k]);
            }
        }
        foreach ($data as $k => $v) {
            if (is_array($v)) {
                $data[$k] = self::localize($v, $isAr);
            }
        }

        return $data;
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

    /** Lucide name for a stored icon key (legacy keys mapped), or null when it is not in the list. */
    public static function icon(mixed $value): ?string
    {
        $value = is_string($value) ? trim($value) : '';
        $value = self::LEGACY_ICONS[$value] ?? $value;

        return isset(self::ICONS[$value]) ? $value : null;
    }

    /** A just-uploaded file (relative path on the public disk) becomes its public /storage/... URL. */
    public static function imagePath(mixed $value): string
    {
        if (is_array($value)) {
            $value = reset($value) ?: '';
        }
        $value = is_string($value) ? trim($value) : '';
        if ($value !== '' && ! str_starts_with($value, '/') && preg_match('#^media/[a-zA-Z0-9_./-]+$#', $value)) {
            $value = '/storage/'.$value;
        }

        return $value;
    }

    /** @return array{type: string, data: array<string, mixed>} */
    private static function section(array $section): array
    {
        $type = is_string($section['type'] ?? null) ? $section['type'] : '';
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

        $label = self::TYPES[$type];
        $data = ['enabled' => ! array_key_exists('enabled', $in) || (bool) $in['enabled']]
            + self::fields(self::FIELDS[$type] + (self::LISTS[$type] ?? []), $in, self::REQUIRED[$type] ?? [], $label, $type);

        return ['type' => $type, 'data' => $data];
    }

    /**
     * Same field kinds for other storefront settings (header / footer, see SiteLayout).
     *
     * @param  array<string, mixed>  $spec
     * @param  array<mixed>  $in
     * @param  list<string>  $required
     * @return array<string, mixed>
     */
    public static function clean(array $spec, array $in, array $required, string $label): array
    {
        return self::fields($spec, $in, $required, $label, '');
    }

    /**
     * Normalise and validate one object (a section or a list item) against its field spec.
     *
     * @param  array<string, mixed>  $spec
     * @param  array<mixed>  $in
     * @param  list<string>  $required
     * @return array<string, mixed>
     */
    private static function fields(array $spec, array $in, array $required, string $label, string $type): array
    {
        $data = [];
        $rules = [];
        foreach ($spec as $key => $kind) {
            if (is_array($kind)) {
                $data[$key] = self::list($kind, $in[$key] ?? [], $label, $type);

                continue;
            }
            if ($kind === 'bool' || $kind === 'bool1') {
                $data[$key] = (bool) ($in[$key] ?? ($kind === 'bool1'));

                continue;
            }
            if (is_string($kind) && str_starts_with($kind, 'int:')) {
                [, $min, $max, $default] = array_map('intval', explode(':', $kind));
                $value = $in[$key] ?? null;
                $data[$key] = max($min, min($max, is_numeric($value) ? (int) $value : $default));

                continue;
            }
            if ($kind === 'icon') {
                $raw = is_string($in[$key] ?? null) ? trim($in[$key]) : '';
                $icon = self::icon($raw);
                if ($raw !== '' && $icon === null) {
                    if ($type !== 'usps') {
                        throw ValidationException::withMessages(['blocks' => "Section « {$label} » : icône inconnue ({$raw})."]);
                    }
                    $icon = 'badge-check'; // legacy section: unknown icons were silently replaced
                }
                $data[$key] = $icon ?? '';

                continue;
            }
            $value = $kind === 'image' ? self::imagePath($in[$key] ?? '') : trim((string) (is_scalar($in[$key] ?? null) ? $in[$key] : ''));
            $data[$key] = $value;
            $rules[$key] = match ($kind) {
                'link' => ['string', 'max:500', 'regex:'.self::LINK],
                'menuLink' => ['string', 'max:500', 'regex:'.\App\Models\SiteMenu::LINK],
                'image' => ['string', 'max:500', 'regex:'.self::IMAGE, 'not_regex:#\.\.#'],
                'anchor' => ['string', 'max:40', 'regex:'.self::ANCHOR],
                'phone' => ['string', 'max:30', 'regex:'.self::PHONE],
                'digits' => ['string', 'max:20', 'regex:'.self::DIGITS],
                default => ['string', 'max:'.$kind],
            };
        }
        foreach ($required as $key) {
            if (isset($rules[$key])) {
                $rules[$key] = array_merge(['required'], $rules[$key]);
            }
        }
        $validator = Validator::make($data, self::nullableStrings($rules), ['not_regex' => 'Le champ :attribute n’est pas un chemin d’image valide.']);
        if ($validator->fails()) {
            throw ValidationException::withMessages(['blocks' => "Section « {$label} » : ".$validator->errors()->first()]);
        }

        return $data;
    }

    /**
     * @param  array{0: int, 1: array<string, mixed>|null, 2?: list<string>, 3?: int}  $listSpec
     * @return list<mixed>
     */
    private static function list(array $listSpec, mixed $raw, string $label, string $type): array
    {
        $maxItems = $listSpec[0];
        $itemSpec = $listSpec[1];
        $list = array_values(array_filter(is_array($raw) ? $raw : [], fn ($v) => $v !== null && $v !== ''));
        if (count($list) > $maxItems) {
            throw ValidationException::withMessages(['blocks' => "Section « {$label} » : {$maxItems} éléments maximum."]);
        }
        if ($itemSpec === null) {
            return array_values(array_unique(array_map(fn ($v) => substr(trim((string) $v), 0, 160), array_filter($list, 'is_scalar'))));
        }
        $items = [];
        foreach ($list as $item) {
            if (is_array($item)) {
                $items[] = self::fields($itemSpec, $item, $listSpec[2] ?? [], $label, $type);
            }
        }
        if (count($items) < ($listSpec[3] ?? 0)) {
            throw ValidationException::withMessages(['blocks' => "Section « {$label} » : ajoutez au moins {$listSpec[3]} élément."]);
        }

        return $items;
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
