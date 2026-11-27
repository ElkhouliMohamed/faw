<?php

namespace App\Services;

/**
 * Header and footer texts of the storefront (SystemConfig "layout", Filament: Contenu › En-tête & pied de page).
 * Contact details and social links stay in "Coordonnées & réseaux sociaux"; link columns in "Menus du site".
 */
final class SiteLayout
{
    public const LABEL = 'En-tête & pied de page';

    private const SPEC = [
        'topbarEnabled' => 'bool1',
        'topbar' => [4, ['icon' => 'icon', 'text' => 90, 'text_ar' => 90, 'url' => 'menuLink'], ['text']],
        'headerCtaEnabled' => 'bool1',
        'headerCtaIcon' => 'icon',
        'headerCtaLabel' => 40, 'headerCtaLabel_ar' => 40,
        'headerCtaUrl' => 'menuLink',
        'headerCtaShowPhone' => 'bool1',
        'footerText' => 300, 'footerText_ar' => 300,
        'footerContactTitle' => 40, 'footerContactTitle_ar' => 40,
        'copyright' => 160, 'copyright_ar' => 160,
    ];

    /** @return list<string> */
    public static function keys(): array
    {
        return array_keys(self::SPEC);
    }

    /** Defaults = the client's mockup. */
    public static function defaults(): array
    {
        return [
            'topbarEnabled' => true,
            'topbar' => [
                ['icon' => 'truck', 'text' => 'Livraison & installation sur tout le Maroc', 'text_ar' => 'التوصيل والتركيب في جميع أنحاء المغرب', 'url' => ''],
                ['icon' => 'shield-check', 'text' => 'Produits certifiés européen (EN 1634-1)', 'text_ar' => 'منتجات بشهادة أوروبية (EN 1634-1)', 'url' => ''],
                ['icon' => 'headset', 'text' => 'Support & devis rapide', 'text_ar' => 'دعم وعرض سعر سريع', 'url' => '/devis'],
            ],
            'headerCtaEnabled' => true,
            'headerCtaIcon' => 'file-text',
            'headerCtaLabel' => 'Demander un devis', 'headerCtaLabel_ar' => 'اطلب عرض سعر',
            'headerCtaUrl' => '/devis',
            'headerCtaShowPhone' => true,
            'footerText' => 'Portes coupe-feu EI₂60, EI₂90 et EI₂120 certifiées, pour la sécurité de vos bâtiments au Maroc.',
            'footerText_ar' => 'أبواب مقاومة للحريق EI₂60 وEI₂90 وEI₂120 معتمدة، لسلامة مبانيكم في المغرب.',
            'footerContactTitle' => 'Contact', 'footerContactTitle_ar' => 'اتصل بنا',
            'copyright' => '© {year} FAW Aluminium. Tous droits réservés.',
            'copyright_ar' => '© {year} FAW Aluminium. جميع الحقوق محفوظة.',
        ];
    }

    /**
     * Validated values to store (throws ValidationException on invalid input).
     *
     * @param  array<string, mixed>  $fields
     * @return array<string, mixed>
     */
    public static function normalize(array $fields): array
    {
        return HomeSections::clean(self::SPEC, $fields, [], self::LABEL);
    }

    /**
     * Public payload in the requested language (French fallback). Stored values that no longer validate fall back to the defaults.
     *
     * @param  array<string, mixed>  $stored
     * @return array<string, mixed>
     */
    public static function public(array $stored, string $locale): array
    {
        try {
            $values = self::normalize(array_replace(self::defaults(), array_intersect_key($stored, self::SPEC)));
        } catch (\Illuminate\Validation\ValidationException) {
            $values = self::normalize(self::defaults());
        }

        return HomeSections::localize($values, $locale === 'ar');
    }
}
