<?php

namespace App\Services;

/**
 * The client's home page model (docs/design/home-mockup.jpg), French + Arabic, in the stored Builder shape.
 *
 * Used for a new home page (Filament form default), by the "Réinitialiser avec le modèle" action, by the seeder,
 * and by the API while no home page has been published. Images point to photos shipped with the storefront;
 * empty images are rendered as neutral placeholders until the client uploads real photos.
 */
final class HomeTemplate
{
    /** @return list<array{type: string, data: array<string, mixed>}> */
    public static function sections(): array
    {
        $doorPhoto = '/images/alt/CF-EI60-1V-photo-posee.jpg';

        return [
            ['type' => 'heroSlider', 'data' => [
                'enabled' => true, 'autoplay' => true, 'interval' => 6,
                'slides' => [
                    self::slide(
                        ['Portes coupe-feu', 'أبواب مقاومة للحريق'],
                        ['Sécurité Incendie pour Vos Bâtiments', 'السلامة من الحريق لمبانيكم'],
                        ['Des portes coupe-feu certifiées, fiables et durables pour une protection maximale des personnes et des biens.', 'أبواب مقاومة للحريق معتمدة وموثوقة ومتينة لحماية قصوى للأشخاص والممتلكات.'],
                        $doorPhoto,
                        ['Porte coupe-feu FAW installée dans un couloir', 'باب FAW مقاوم للحريق مركب في ممر'],
                    ),
                    self::slide(
                        ['Sur-mesure', 'حسب المقاس'],
                        ['Des portes adaptées à chaque projet', 'أبواب ملائمة لكل مشروع'],
                        ['Simple ou double vantail, dimensions et finitions sur-mesure : nous étudions votre besoin et vous proposons la bonne solution.', 'بدفة واحدة أو دفتين، مقاسات وتشطيبات حسب الطلب: ندرس حاجتكم ونقترح عليكم الحل المناسب.'],
                        '/images/alt/CF-EI60-2V-photo-02.jpg',
                        ['Porte coupe-feu deux vantaux FAW', 'باب FAW مقاوم للحريق بدفتين'],
                    ),
                    self::slide(
                        ['Partout au Maroc', 'في جميع أنحاء المغرب'],
                        ['Livraison et installation professionnelle', 'توصيل وتركيب احترافي'],
                        ['Nos équipes livrent et installent vos portes coupe-feu dans tout le Maroc, avec un suivi après la pose.', 'فرقنا تقوم بتوصيل وتركيب أبوابكم المقاومة للحريق في جميع أنحاء المغرب، مع متابعة بعد التركيب.'],
                        '/images/products/v7-2/CF-EI60-140-2V-photo.jpg',
                        ['Porte coupe-feu FAW posée', 'باب FAW مقاوم للحريق بعد التركيب'],
                    ),
                ],
            ]],
            ['type' => 'features', 'data' => [
                'enabled' => true, 'title' => 'Nos atouts', 'title_ar' => 'مميزاتنا',
                'items' => [
                    self::item('flame', 'Résistance au feu', 'مقاومة للنار'),
                    self::item('shield-check', 'Sécurité renforcée', 'أمان معزز'),
                    self::item('settings', 'Sur-mesure et adaptable', 'حسب المقاس وقابلة للتكييف'),
                    self::item('wrench', 'Installation professionnelle', 'تركيب احترافي'),
                ],
            ]],
            ['type' => 'products', 'data' => [
                'enabled' => true, 'anchor' => 'produits',
                'eyebrow' => 'Nos produits', 'eyebrow_ar' => 'منتجاتنا',
                'title' => 'Nos portes coupe-feu', 'title_ar' => 'أبوابنا المقاومة للحريق',
                'subtitle' => 'Une gamme complète de portes certifiées (EI₂60, EI₂90, EI₂120) adaptée à tous vos projets : tertiaires, industriels et publics.',
                'subtitle_ar' => 'تشكيلة كاملة من الأبواب المعتمدة (EI₂60، EI₂90، EI₂120) تناسب جميع مشاريعكم: المكاتب والصناعة والمرافق العمومية.',
                'linkLabel' => 'Voir toute la gamme', 'linkLabel_ar' => 'عرض كل التشكيلة', 'linkUrl' => '/produits/portes-coupe-feu',
                'category' => '', 'count' => 3, 'ids' => [],
                'cards' => [
                    self::card('Porte coupe-feu EI₂60', 'باب مقاوم للحريق EI₂60', 'Résistance 60 minutes', 'مقاومة 60 دقيقة', '/images/products/v6/CF-EI60-100.jpg'),
                    self::card('Porte coupe-feu EI₂90', 'باب مقاوم للحريق EI₂90', 'Résistance 90 minutes', 'مقاومة 90 دقيقة', '/images/products/v6/CF-EI60-90.jpg'),
                    self::card('Porte coupe-feu EI₂120', 'باب مقاوم للحريق EI₂120', 'Résistance 120 minutes', 'مقاومة 120 دقيقة', '/images/products/v6/CF-EI60-120-1V.jpg'),
                ],
            ]],
            ['type' => 'sectors', 'data' => [
                'enabled' => true, 'anchor' => 'solutions',
                'eyebrow' => 'Nos solutions', 'eyebrow_ar' => 'حلولنا',
                'title' => 'Des solutions pour tous les secteurs', 'title_ar' => 'حلول لجميع القطاعات',
                'text' => 'Nos portes coupe-feu s’intègrent parfaitement dans différents types de bâtiments et d’environnements.',
                'text_ar' => 'تندمج أبوابنا المقاومة للحريق بشكل مثالي في مختلف أنواع المباني والبيئات.',
                'items' => [
                    ['icon' => 'building-2', 'label' => 'Bureaux & Tertiaire', 'label_ar' => 'المكاتب والخدمات', 'url' => ''],
                    ['icon' => 'factory', 'label' => 'Industrie & Logistique', 'label_ar' => 'الصناعة واللوجستيك', 'url' => ''],
                    ['icon' => 'hospital', 'label' => 'Santé & Hôpitaux', 'label_ar' => 'الصحة والمستشفيات', 'url' => ''],
                    ['icon' => 'landmark', 'label' => 'Établissements Publics', 'label_ar' => 'المؤسسات العمومية', 'url' => ''],
                    ['icon' => 'building', 'label' => 'Résidentiel & ERP', 'label_ar' => 'السكن والمؤسسات المستقبلة للجمهور', 'url' => ''],
                ],
            ]],
            ['type' => 'about', 'data' => [
                'enabled' => true, 'anchor' => 'a-propos',
                'image' => '', 'imageAlt' => 'Bâtiment FAW Aluminium', 'imageAlt_ar' => 'مقر FAW Aluminium',
                'eyebrow' => 'À propos', 'eyebrow_ar' => 'من نحن',
                'title' => 'L’expertise FAW', 'title_ar' => 'خبرة FAW',
                'text' => 'Spécialisée dans les solutions de fermeture coupe-feu, FAW Aluminium vous accompagne dans la sécurisation de vos bâtiments grâce à des produits certifiés, un service réactif et un accompagnement sur mesure.',
                'text_ar' => 'متخصصة في حلول الإغلاق المقاومة للحريق، ترافقكم FAW Aluminium في تأمين مبانيكم بفضل منتجات معتمدة وخدمة سريعة ومواكبة حسب الطلب.',
                'checklist' => [
                    ['text' => 'Conseil et étude de projet', 'text_ar' => 'الاستشارة ودراسة المشروع'],
                    ['text' => 'Fourniture et installation', 'text_ar' => 'التوريد والتركيب'],
                    ['text' => 'Suivi et service après-vente', 'text_ar' => 'المتابعة وخدمة ما بعد البيع'],
                ],
                'buttonLabel' => 'Découvrir FAW', 'buttonLabel_ar' => 'اكتشفوا FAW', 'buttonUrl' => '/contact',
            ]],
            ['type' => 'highlights', 'data' => [
                'enabled' => true,
                'title' => 'Pourquoi choisir nos portes coupe-feu ?', 'title_ar' => 'لماذا تختارون أبوابنا المقاومة للحريق؟',
                'backgroundImage' => '',
                'items' => [
                    ['icon' => 'award', 'label' => 'Certification européenne', 'label_ar' => 'شهادة أوروبية'],
                    ['icon' => 'gem', 'label' => 'Qualité et durabilité', 'label_ar' => 'الجودة والمتانة'],
                    ['icon' => 'sliders-horizontal', 'label' => 'Options personnalisées', 'label_ar' => 'خيارات مخصصة'],
                    ['icon' => 'headset', 'label' => 'Accompagnement complet', 'label_ar' => 'مواكبة شاملة'],
                ],
            ]],
            ['type' => 'projects', 'data' => [
                'enabled' => true, 'anchor' => 'realisations',
                'eyebrow' => 'Nos réalisations', 'eyebrow_ar' => 'إنجازاتنا',
                'title' => 'Ils nous font confiance', 'title_ar' => 'يثقون بنا',
                'linkLabel' => 'Voir nos réalisations', 'linkLabel_ar' => 'عرض إنجازاتنا', 'linkUrl' => '/contact',
                'items' => [
                    ['image' => '', 'title' => 'Bureaux & tertiaire', 'title_ar' => 'المكاتب والخدمات', 'location' => 'Maroc', 'location_ar' => 'المغرب', 'url' => ''],
                    ['image' => '', 'title' => 'Industrie & logistique', 'title_ar' => 'الصناعة واللوجستيك', 'location' => 'Maroc', 'location_ar' => 'المغرب', 'url' => ''],
                    ['image' => '', 'title' => 'Établissements publics', 'title_ar' => 'المؤسسات العمومية', 'location' => 'Maroc', 'location_ar' => 'المغرب', 'url' => ''],
                    ['image' => '', 'title' => 'Résidentiel', 'title_ar' => 'السكن', 'location' => 'Maroc', 'location_ar' => 'المغرب', 'url' => ''],
                ],
            ]],
            ['type' => 'process', 'data' => [
                'enabled' => true, 'anchor' => 'processus',
                'eyebrow' => 'Notre processus', 'eyebrow_ar' => 'طريقة عملنا',
                'title' => 'Un accompagnement simple et efficace', 'title_ar' => 'مواكبة بسيطة وفعالة',
                'text' => '', 'text_ar' => '',
                'steps' => [
                    ['icon' => 'message-circle', 'title' => 'Prise de contact et analyse du besoin', 'title_ar' => 'التواصل وتحليل الحاجة', 'text' => '', 'text_ar' => ''],
                    ['icon' => 'file-text', 'title' => 'Étude et proposition', 'title_ar' => 'الدراسة والعرض', 'text' => '', 'text_ar' => ''],
                    ['icon' => 'truck', 'title' => 'Fourniture et installation', 'title_ar' => 'التوريد والتركيب', 'text' => '', 'text_ar' => ''],
                    ['icon' => 'shield-check', 'title' => 'Suivi et service après-vente', 'title_ar' => 'المتابعة وخدمة ما بعد البيع', 'text' => '', 'text_ar' => ''],
                ],
            ]],
            ['type' => 'cta', 'data' => [
                'enabled' => true,
                'title' => 'Un projet, une question ?', 'title_ar' => 'مشروع أو سؤال؟',
                'text' => 'Nos équipes sont à votre écoute pour vous conseiller et vous proposer la solution la plus adaptée.',
                'text_ar' => 'فرقنا رهن إشارتكم لتقديم النصيحة واقتراح الحل الأنسب لكم.',
                'label' => '', 'label_ar' => '', 'url' => '',
                'showPhone' => true, 'phone' => '', 'phoneLabel' => '', 'phoneLabel_ar' => '',
                'showWhatsapp' => true, 'whatsappNumber' => '', 'whatsappLabel' => '', 'whatsappLabel_ar' => '',
                'backgroundImage' => '',
            ]],
        ];
    }

    /**
     * Menus of the model (header with the "Produits" dropdown, footer columns, legal links), by SiteMenu location.
     *
     * @return array<string, array{title: string, title_ar: string, items: list<array<string, mixed>>}>
     */
    public static function menus(): array
    {
        $l = fn (string $label, string $ar, string $url, array $children = []) => ['label' => $label, 'label_ar' => $ar, 'url' => $url, 'newTab' => false, 'highlight' => false] + ($children ? ['children' => $children] : []);
        $products = [
            $l('Portes coupe-feu', 'أبواب مقاومة للحريق', '/produits/portes-coupe-feu'),
            $l('Portes coulissantes encastrables', 'أبواب منزلقة مدمجة', '/produits/portes-galandage'),
            $l('Matériel incendie', 'معدات مكافحة الحريق', '/produits/incendie'),
            $l('Tous les produits', 'كل المنتجات', '/produits'),
        ];
        $quick = [
            $l('Accueil', 'الرئيسية', '/'),
            $l('Produits', 'المنتجات', '/produits'),
            $l('Solutions', 'الحلول', '/#solutions'),
            $l('Réalisations', 'الإنجازات', '/#realisations'),
            $l('À propos', 'من نحن', '/#a-propos'),
            $l('Contact', 'اتصل بنا', '/contact'),
        ];
        $header = $quick;
        $header[1] = $l('Produits', 'المنتجات', '/produits', $products);

        return [
            'header' => ['title' => 'Menu principal', 'title_ar' => 'القائمة الرئيسية', 'items' => $header],
            'footer_info' => ['title' => 'Liens rapides', 'title_ar' => 'روابط سريعة', 'items' => $quick],
            'footer_shop' => ['title' => 'Nos produits', 'title_ar' => 'منتجاتنا', 'items' => [
                $l('Portes coupe-feu EI₂60', 'أبواب مقاومة للحريق EI₂60', '/produits/portes-coupe-feu'),
                $l('Portes coupe-feu EI₂90', 'أبواب مقاومة للحريق EI₂90', '/produits/portes-coupe-feu'),
                $l('Portes coupe-feu EI₂120', 'أبواب مقاومة للحريق EI₂120', '/produits/portes-coupe-feu'),
                $l('Portes coulissantes', 'أبواب منزلقة', '/produits/portes-galandage'),
                $l('Accessoires', 'إكسسوارات', '/produits'),
                $l('Sur-mesure', 'حسب المقاس', '/devis'),
            ]],
            'footer_legal' => ['title' => 'Liens légaux', 'title_ar' => 'روابط قانونية', 'items' => [
                $l('Mentions légales', 'الإشعارات القانونية', '/livraison#mentions'),
                $l('Politique de confidentialité', 'سياسة الخصوصية', '/livraison#confidentialite'),
            ]],
        ];
    }

    /** @param array{0: string, 1: string} $eyebrow */
    private static function slide(array $eyebrow, array $title, array $subtitle, string $image, array $alt): array
    {
        return [
            'eyebrow' => $eyebrow[0], 'eyebrow_ar' => $eyebrow[1],
            'title' => $title[0], 'title_ar' => $title[1],
            'subtitle' => $subtitle[0], 'subtitle_ar' => $subtitle[1],
            'image' => $image, 'imageAlt' => $alt[0], 'imageAlt_ar' => $alt[1], 'imageWhole' => true,
            'primaryLabel' => 'Demander un devis', 'primaryLabel_ar' => 'اطلب عرض سعر', 'primaryUrl' => '/devis',
            'secondaryLabel' => 'WhatsApp', 'secondaryLabel_ar' => 'واتساب', 'secondaryUrl' => '', 'secondaryWhatsapp' => true,
            'highlightIcon' => 'flame',
            'highlights' => [['text' => 'EI₂60'], ['text' => 'EI₂90'], ['text' => 'EI₂120']],
            'badges' => [
                ['icon' => 'shield-check', 'line1' => 'Certifiées', 'line1_ar' => 'معتمدة', 'line2' => 'EN 1634-1', 'line2_ar' => 'EN 1634-1'],
                ['icon' => 'globe', 'line1' => 'Fabrication', 'line1_ar' => 'صناعة', 'line2' => 'Européenne', 'line2_ar' => 'أوروبية'],
                ['icon' => 'badge-check', 'line1' => 'Conformes', 'line1_ar' => 'مطابقة', 'line2' => 'aux normes', 'line2_ar' => 'للمعايير'],
            ],
        ];
    }

    private static function item(string $icon, string $title, string $titleAr): array
    {
        return ['icon' => $icon, 'title' => $title, 'title_ar' => $titleAr, 'text' => '', 'text_ar' => ''];
    }

    private static function card(string $title, string $titleAr, string $text, string $textAr, string $image): array
    {
        return ['image' => $image, 'imageAlt' => $title, 'title' => $title, 'title_ar' => $titleAr, 'text' => $text, 'text_ar' => $textAr, 'url' => '/produits/portes-coupe-feu'];
    }
}
