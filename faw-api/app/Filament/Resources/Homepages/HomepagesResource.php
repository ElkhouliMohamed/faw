<?php

namespace App\Filament\Resources\Homepages;

use App\Filament\Resources\ContentPages\ContentLayout;
use App\Filament\Resources\ContentResource;
use App\Models\Category;
use App\Models\Media;
use App\Models\Product;
use App\Services\HomeSections;
use App\Services\HomeTemplate;
use Filament\Forms\Components\Builder;
use Filament\Forms\Components\Builder\Block;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Fieldset;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Tables\Table;
use Illuminate\Support\Facades\Storage;

/**
 * The home page is a single record (the list redirects to it once it exists, see ListHomepages).
 * Its sections are a Builder: one block per section type, ordered, each one can be hidden without being deleted.
 * French fields on the left, Arabic on the right (Arabic empty = French text shown).
 * Without a published home record the storefront shows the client's model (HomeTemplate).
 */
class HomepagesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Accueil';

    protected static ?string $modelLabel = 'page d’accueil';

    protected static ?string $pluralModelLabel = 'Accueil';

    protected static ?string $slug = 'homepages';

    public static string $contentKind = 'home';

    private const GRID = ['default' => 1, 'lg' => 2];

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Tabs::make('Accueil')->tabs([
                Tab::make('Sections')->icon('heroicon-o-squares-2x2')->schema([
                    Section::make('Sections de la page d’accueil')
                        ->description('Affichées dans cet ordre, de haut en bas. Glissez pour réordonner ; cliquez sur une section pour l’ouvrir ; décochez « Afficher » pour la masquer sans la supprimer. Colonne de gauche : français ; colonne de droite : arabe (vide = texte français affiché).')
                        ->schema([static::sectionsBuilder()]),
                ]),
                Tab::make('Réglages & SEO')->icon('heroicon-o-globe-alt')->schema([
                    Section::make('Page')
                        ->description('Titre de l’onglet du navigateur et texte de repli si aucune bannière n’est définie.')
                        ->schema([
                            TextInput::make('title')->label('Titre de la page')->required()->maxLength(120)->default('Accueil'),
                            TextInput::make('title_ar')->label('Titre (arabe)')->maxLength(120)->extraInputAttributes(['dir' => 'rtl']),
                            Textarea::make('excerpt')->label('Sous-titre de repli')->maxLength(1000)->rows(2),
                            Textarea::make('excerpt_ar')->label('Sous-titre (arabe)')->maxLength(1000)->rows(2)->extraInputAttributes(['dir' => 'rtl']),
                            TextInput::make('slug')->label('Identifiant URL')->default('accueil')->disabled()->dehydrated()->required(),
                            Hidden::make('kind')->default('home')->dehydrateStateUsing(fn () => 'home'),
                            Toggle::make('published')->label('Publié')->default(true)
                                ->helperText('Non publié : le site affiche le modèle d’accueil par défaut.'),
                        ])->columns(self::GRID),
                    Section::make('Référencement')
                        ->description('Titre et description proposés à Google. Vides = valeurs générales du site.')
                        ->schema([
                            TextInput::make('seoTitle')->label('Titre SEO')->maxLength(160),
                            TextInput::make('seoTitle_ar')->label('Titre SEO (arabe)')->maxLength(160)->extraInputAttributes(['dir' => 'rtl']),
                            Textarea::make('seoDescription')->label('Description SEO')->maxLength(320)->rows(3),
                            Textarea::make('seoDescription_ar')->label('Description SEO (arabe)')->maxLength(320)->rows(3)->extraInputAttributes(['dir' => 'rtl']),
                        ])->columns(self::GRID),
                ]),
            ])->persistTabInQueryString()->columnSpanFull(),
        ])->columns(1);
    }

    /* ------------------------------------------------------------------ */
    /* Field helpers                                                       */
    /* ------------------------------------------------------------------ */

    /**
     * A French field and its Arabic twin, side by side.
     *
     * @return array{0: TextInput|Textarea, 1: TextInput|Textarea}
     */
    public static function tr(string $name, string $label, int $max, bool $area = false, bool $required = false, string $placeholder = '', ?string $help = null): array
    {
        $make = fn (string $n) => $area ? Textarea::make($n)->rows(3) : TextInput::make($n);
        $fr = $make($name)->label($label)->maxLength($max)->required($required)->placeholder($placeholder);
        if ($help) {
            $fr->helperText($help);
        }
        $ar = $make($name.'_ar')->label($label.' (arabe)')->maxLength($max)->extraInputAttributes(['dir' => 'rtl'])
            ->helperText('Facultatif : vide = texte français.');

        return [$fr, $ar];
    }

    public static function link(string $name, string $label, string $placeholder = '/devis'): TextInput
    {
        return TextInput::make($name)->label($label)->maxLength(500)->regex(HomeSections::LINK)->placeholder($placeholder)
            ->helperText('Lien interne (/produits, /devis, /#solutions…) ou adresse https://. Vide = pas de lien.')
            ->validationMessages(['regex' => 'Lien interne commençant par / ou adresse https://.']);
    }

    public static function icon(string $name = 'icon', string $label = 'Icône'): Select
    {
        return Select::make($name)->label($label)->options(HomeSections::ICONS)->searchable()->native(false)
            ->placeholder('Choisir une icône')->in(array_keys(HomeSections::ICONS));
    }

    public static function anchor(string $default): TextInput
    {
        return TextInput::make('anchor')->label('Ancre (lien du menu)')->maxLength(40)->default($default)->regex(HomeSections::ANCHOR)->prefix('/#')
            ->helperText('Permet un lien de menu vers cette section, ex. /#'.$default.'. Minuscules, chiffres et tirets.');
    }

    public static function enabled(): Toggle
    {
        return Toggle::make('enabled')->label('Afficher cette section')->default(true)->columnSpanFull();
    }

    /** Image upload into the media folder; also shows photos shipped with the site (/images/…). */
    public static function image(string $name = 'image', string $label = 'Image'): FileUpload
    {
        return FileUpload::make($name)->label($label)
            ->image()
            ->disk('public')->directory(HomeSections::UPLOAD_DIR)->visibility('public')
            ->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
            ->maxSize(5120)
            ->imagePreviewHeight('140')
            ->fetchFileInformation(false)
            ->getUploadedFileUsing(fn (string $file): array => ['name' => basename($file), 'size' => 0, 'type' => null, 'url' => static::imageUrl($file)])
            ->helperText('JPEG, PNG, WebP ou AVIF, 5 Mo maximum. Vide = visuel de remplacement.');
    }

    /** Public URL of a stored image value: "/images/…" and "/storage/…" are already public paths. */
    public static function imageUrl(string $file): string
    {
        return str_starts_with($file, '/') ? $file : Storage::disk('public')->url($file);
    }

    /** Collapsed block label: section type, its title, "(masquée)". */
    private static function blockLabel(string $type, ?string $titleKey = 'title'): \Closure
    {
        return function (?array $state) use ($type, $titleKey): string {
            $title = $titleKey ? ($state[$titleKey] ?? null) : null;
            if ($type === 'heroSlider') {
                $title = $state['slides'][array_key_first($state['slides'] ?? []) ?? 0]['title'] ?? null;
            }

            return HomeSections::TYPES[$type]
                .(filled($title) && is_string($title) ? ' — '.$title : '')
                .(($state['enabled'] ?? true) ? '' : ' (masquée)');
        };
    }

    private static function repeater(string $name, string $label, int $max, array $schema, string $add, ?string $titleKey = null): Repeater
    {
        $repeater = Repeater::make($name)->label($label)->schema($schema)
            // Items start closed (title shown) so long lists like slides stay readable; open one to edit it.
            ->columns(self::GRID)->maxItems($max)->reorderable()->collapsible()->collapsed()->cloneable()
            ->addActionLabel($add)->columnSpanFull();
        if ($titleKey) {
            $repeater->itemLabel(fn (array $state): ?string => filled($state[$titleKey] ?? null) ? (string) $state[$titleKey] : null);
        }

        return $repeater;
    }

    /* ------------------------------------------------------------------ */
    /* Sections                                                            */
    /* ------------------------------------------------------------------ */

    public static function sectionsBuilder(): Builder
    {
        return Builder::make('blocks')->hiddenLabel()->blocks([
            static::heroSliderBlock(),
            static::featuresBlock(),
            static::productsBlock(),
            static::sectorsBlock(),
            static::aboutBlock(),
            static::highlightsBlock(),
            static::projectsBlock(),
            static::processBlock(),
            static::ctaBlock(),
            ...static::legacyBlocks(),
        ])
            ->default(HomeTemplate::sections())
            ->maxItems(HomeSections::MAX)
            ->reorderable()
            ->collapsible()
            ->collapsed()
            ->cloneable()
            ->blockNumbers(false)
            ->blockPickerColumns(['default' => 1, 'md' => 2])
            ->addActionLabel('Ajouter une section')
            ->columnSpanFull();
    }

    protected static function heroSliderBlock(): Block
    {
        return Block::make('heroSlider')->label(self::blockLabel('heroSlider'))->icon('heroicon-o-photo')->schema([
            static::enabled(),
            Toggle::make('autoplay')->label('Défilement automatique')->default(true)
                ->helperText('S’arrête au survol de la souris ; désactivé pour les visiteurs qui limitent les animations.'),
            Select::make('interval')->label('Durée d’une diapositive')->options([4 => '4 secondes', 5 => '5 secondes', 6 => '6 secondes', 8 => '8 secondes', 10 => '10 secondes'])->default(6)->native(false),
            static::repeater('slides', 'Diapositives', 6, [
                ...static::tr('eyebrow', 'Sur-titre (orange)', 80, placeholder: 'PORTES COUPE-FEU'),
                ...static::tr('title', 'Titre', 140, required: true),
                ...static::tr('subtitle', 'Texte', 400, area: true),
                Fieldset::make('Photo')->schema([
                    static::image()->columnSpanFull(),
                    ...static::tr('imageAlt', 'Description de la photo (accessibilité, Google)', 160),
                    Toggle::make('imageWhole')->label('Afficher la photo entière (sans la recadrer)')->default(false)->columnSpanFull()
                        ->helperText('À activer pour une photo en hauteur (ex. une porte seule). Désactivé : la photo remplit toute la moitié droite de la bannière.'),
                ])->columns(self::GRID)->columnSpanFull(),
                Fieldset::make('Boutons')->schema([
                    ...static::tr('primaryLabel', 'Bouton orange', 40, placeholder: 'Demander un devis'),
                    static::link('primaryUrl', 'Lien du bouton orange')->columnSpanFull(),
                    Toggle::make('secondaryWhatsapp')->label('Le bouton blanc ouvre WhatsApp')->default(true)->live()->columnSpanFull()
                        ->helperText('Numéro WhatsApp : Paramètres › Coordonnées, réseaux sociaux & bouton flottant.'),
                    ...static::tr('secondaryLabel', 'Bouton blanc', 40, placeholder: 'WhatsApp'),
                    static::link('secondaryUrl', 'Lien du bouton blanc', '/produits')->columnSpanFull()
                        ->hidden(fn (Get $get): bool => (bool) $get('secondaryWhatsapp')),
                ])->columns(self::GRID)->columnSpanFull(),
                Fieldset::make('Pastille rouge sur la photo')->schema([
                    static::icon('highlightIcon', 'Icône de la pastille')->default('flame'),
                    Repeater::make('highlights')->label('Lignes (ex. EI₂60)')->schema([
                        TextInput::make('text')->hiddenLabel()->required()->maxLength(30)->placeholder('EI₂60'),
                    ])->maxItems(6)->reorderable()->addActionLabel('Ajouter une ligne')->defaultItems(0),
                ])->columns(self::GRID)->columnSpanFull(),
                static::repeater('badges', 'Petits badges sous les boutons', 4, [
                    static::icon()->columnSpanFull(),
                    ...static::tr('line1', 'Ligne 1 (gras)', 40, required: true, placeholder: 'Certifiées'),
                    ...static::tr('line2', 'Ligne 2', 40, placeholder: 'EN 1634-1'),
                ], 'Ajouter un badge', 'line1'),
            ], 'Ajouter une diapositive', 'title')->minItems(1)->defaultItems(1),
        ])->columns(self::GRID);
    }

    protected static function featuresBlock(): Block
    {
        return Block::make('features')->label(self::blockLabel('features'))->icon('heroicon-o-sparkles')->schema([
            static::enabled(),
            ...static::tr('title', 'Titre (lu par les lecteurs d’écran, non affiché)', 120),
            static::repeater('items', 'Atouts (4 conseillés)', 8, [
                static::icon()->columnSpanFull(),
                ...static::tr('title', 'Libellé', 60, required: true, placeholder: 'Résistance au feu'),
                ...static::tr('text', 'Précision (facultatif)', 160),
            ], 'Ajouter un atout', 'title'),
        ])->columns(self::GRID);
    }

    protected static function productsBlock(): Block
    {
        return Block::make('products')->label(self::blockLabel('products'))->icon('heroicon-o-cube')->schema([
            static::enabled(),
            static::anchor('produits')->columnSpanFull(),
            ...static::tr('eyebrow', 'Sur-titre (orange)', 60, placeholder: 'NOS PRODUITS'),
            ...static::tr('title', 'Titre', 120, placeholder: 'Nos portes coupe-feu'),
            ...static::tr('subtitle', 'Texte', 300, area: true),
            ...static::tr('linkLabel', 'Lien « tout voir »', 40, placeholder: 'Voir toute la gamme'),
            static::link('linkUrl', 'Adresse du lien', '/produits')->columnSpanFull(),
            static::repeater('cards', 'Cartes (photo, nom, ligne grise, lien)', 12, [
                static::image()->columnSpanFull(),
                ...static::tr('title', 'Nom', 80, required: true, placeholder: 'Porte coupe-feu EI₂60'),
                ...static::tr('text', 'Ligne grise', 120, placeholder: 'Résistance 60 minutes'),
                TextInput::make('imageAlt')->label('Description de la photo')->maxLength(160),
                static::link('url', 'Lien de la carte', '/produits/portes-coupe-feu'),
            ], 'Ajouter une carte', 'title'),
            Fieldset::make('Produits du catalogue (en plus des cartes, facultatif)')->schema([
                Select::make('ids')->label('Produits choisis')->multiple()->searchable()->maxItems(12)->columnSpanFull()
                    ->options(fn () => Product::where('active', true)->orderBy('title')->pluck('title', 'id')->all())
                    ->helperText('Prix affiché ou « Demander un devis » selon le produit et les réglages de prix.'),
                Select::make('category')->label('Ou : derniers produits d’une catégorie')->searchable()->native(false)
                    ->options(fn () => Category::where('active', true)->orderBy('sortOrder')->orderBy('id')->pluck('label', 'slug')->all())
                    ->helperText('Utilisé seulement si aucun produit n’est choisi ci-dessus.'),
                Select::make('count')->label('Nombre de produits de la catégorie')->options(array_combine(range(1, 12), range(1, 12)))->default(3)->native(false),
            ])->columns(self::GRID)->columnSpanFull(),
        ])->columns(self::GRID);
    }

    protected static function sectorsBlock(): Block
    {
        return Block::make('sectors')->label(self::blockLabel('sectors'))->icon('heroicon-o-building-office')->schema([
            static::enabled(),
            static::anchor('solutions')->columnSpanFull(),
            ...static::tr('eyebrow', 'Sur-titre (orange)', 60, placeholder: 'NOS SOLUTIONS'),
            ...static::tr('title', 'Titre', 120, placeholder: 'Des solutions pour tous les secteurs'),
            ...static::tr('text', 'Texte', 400, area: true),
            static::repeater('items', 'Secteurs (5 conseillés)', 10, [
                static::icon(),
                static::link('url', 'Lien (facultatif)', '/produits'),
                ...static::tr('label', 'Libellé', 60, required: true, placeholder: 'Bureaux & Tertiaire'),
            ], 'Ajouter un secteur', 'label'),
        ])->columns(self::GRID);
    }

    protected static function aboutBlock(): Block
    {
        return Block::make('about')->label(self::blockLabel('about'))->icon('heroicon-o-information-circle')->schema([
            static::enabled(),
            static::anchor('a-propos')->columnSpanFull(),
            static::image('image', 'Grande photo (à gauche)')->columnSpanFull(),
            ...static::tr('imageAlt', 'Description de la photo', 160),
            ...static::tr('eyebrow', 'Sur-titre (orange)', 60, placeholder: 'À PROPOS'),
            ...static::tr('title', 'Titre', 120, placeholder: 'L’expertise FAW'),
            ...static::tr('text', 'Texte', 1200, area: true),
            static::repeater('checklist', 'Liste à coches', 8, [
                ...static::tr('text', 'Point', 120, required: true, placeholder: 'Conseil et étude de projet'),
            ], 'Ajouter un point', 'text'),
            ...static::tr('buttonLabel', 'Bouton', 40, placeholder: 'Découvrir FAW'),
            static::link('buttonUrl', 'Lien du bouton', '/contact')->columnSpanFull(),
        ])->columns(self::GRID);
    }

    protected static function highlightsBlock(): Block
    {
        return Block::make('highlights')->label(self::blockLabel('highlights'))->icon('heroicon-o-fire')->schema([
            static::enabled(),
            ...static::tr('title', 'Titre', 120, required: true, placeholder: 'Pourquoi choisir nos portes coupe-feu ?'),
            static::image('backgroundImage', 'Image de fond (à droite, facultatif)')->columnSpanFull(),
            static::repeater('items', 'Arguments (4 conseillés)', 6, [
                static::icon()->columnSpanFull(),
                ...static::tr('label', 'Libellé', 60, required: true, placeholder: 'Certification européenne'),
            ], 'Ajouter un argument', 'label'),
        ])->columns(self::GRID);
    }

    protected static function projectsBlock(): Block
    {
        return Block::make('projects')->label(self::blockLabel('projects'))->icon('heroicon-o-building-office-2')->schema([
            static::enabled(),
            static::anchor('realisations')->columnSpanFull(),
            ...static::tr('eyebrow', 'Sur-titre (orange)', 60, placeholder: 'NOS RÉALISATIONS'),
            ...static::tr('title', 'Titre', 120, placeholder: 'Ils nous font confiance'),
            ...static::tr('linkLabel', 'Lien « tout voir »', 40, placeholder: 'Voir nos réalisations'),
            static::link('linkUrl', 'Adresse du lien', '/contact')->columnSpanFull(),
            static::repeater('items', 'Réalisations (4 par ligne)', 12, [
                static::image('image', 'Photo du chantier')->columnSpanFull(),
                ...static::tr('title', 'Nom du projet', 80, required: true),
                ...static::tr('location', 'Lieu', 80, placeholder: 'Casablanca'),
                static::link('url', 'Lien (facultatif)', '/blog/…')->columnSpanFull(),
            ], 'Ajouter une réalisation', 'title'),
        ])->columns(self::GRID);
    }

    protected static function processBlock(): Block
    {
        return Block::make('process')->label(self::blockLabel('process'))->icon('heroicon-o-arrow-path')->schema([
            static::enabled(),
            static::anchor('processus')->columnSpanFull(),
            ...static::tr('eyebrow', 'Sur-titre (orange)', 60, placeholder: 'NOTRE PROCESSUS'),
            ...static::tr('title', 'Titre', 120, placeholder: 'Un accompagnement simple et efficace'),
            ...static::tr('text', 'Texte (facultatif)', 400, area: true),
            static::repeater('steps', 'Étapes (numérotées automatiquement)', 6, [
                static::icon()->columnSpanFull(),
                ...static::tr('title', 'Étape', 60, required: true, placeholder: 'Prise de contact'),
                ...static::tr('text', 'Précision (facultatif)', 200),
            ], 'Ajouter une étape', 'title'),
        ])->columns(self::GRID);
    }

    protected static function ctaBlock(): Block
    {
        return Block::make('cta')->label(self::blockLabel('cta'))->icon('heroicon-o-megaphone')->schema([
            static::enabled(),
            ...static::tr('title', 'Titre', 120, required: true, placeholder: 'Un projet, une question ?'),
            ...static::tr('text', 'Texte', 400, area: true),
            Fieldset::make('Bouton téléphone (blanc)')->schema([
                Toggle::make('showPhone')->label('Afficher')->default(true)->columnSpanFull(),
                TextInput::make('phone')->label('Numéro')->tel()->maxLength(30)->regex(HomeSections::PHONE)->placeholder('+212 522 00 00 00')
                    ->helperText('Vide = téléphone des coordonnées du site.')->columnSpanFull(),
                ...static::tr('phoneLabel', 'Texte du bouton', 40, help: 'Vide = le numéro.'),
            ])->columns(self::GRID)->columnSpanFull(),
            Fieldset::make('Bouton WhatsApp (vert)')->schema([
                Toggle::make('showWhatsapp')->label('Afficher')->default(true)->columnSpanFull(),
                TextInput::make('whatsappNumber')->label('Numéro WhatsApp')->maxLength(20)->regex(HomeSections::DIGITS)->placeholder('212600000000')
                    ->helperText('Chiffres uniquement, avec l’indicatif (212…). Vide = numéro WhatsApp du site.')->columnSpanFull(),
                ...static::tr('whatsappLabel', 'Texte du bouton', 40, help: 'Vide = le numéro.'),
            ])->columns(self::GRID)->columnSpanFull(),
            Fieldset::make('Bouton orange (facultatif)')->schema([
                ...static::tr('label', 'Texte du bouton', 40, placeholder: 'Demander un devis'),
                static::link('url', 'Lien du bouton')->columnSpanFull(),
            ])->columns(self::GRID)->columnSpanFull(),
            static::image('backgroundImage', 'Image de fond (à droite, facultatif)')->columnSpanFull(),
        ])->columns(self::GRID);
    }

    /** Section types of the previous home page design: still editable, still rendered. */
    protected static function legacyBlocks(): array
    {
        $legacyImage = fn (string $name = 'image', string $label = 'Image') => TextInput::make($name)->label($label)->maxLength(500)->regex(HomeSections::IMAGE)
            ->placeholder('/storage/media/photo.webp')->datalist(fn () => Media::query()->orderByDesc('id')->limit(200)->pluck('url')->filter()->values()->all())
            ->helperText('Chemin copié depuis la Médiathèque (/storage/…) ou /images/…');

        return [
            Block::make('hero')->label(self::blockLabel('hero'))->icon('heroicon-o-photo')->schema([
                static::enabled(),
                ...static::tr('eyebrow', 'Sur-titre', 80),
                ...static::tr('title', 'Titre (H1)', 140, required: true),
                ...static::tr('subtitle', 'Texte', 400, area: true),
                static::image(),
                TextInput::make('imageAlt')->label('Description de l’image')->maxLength(160),
                ...static::tr('primaryLabel', 'Bouton principal', 40),
                static::link('primaryUrl', 'Lien du bouton principal')->columnSpanFull(),
                ...static::tr('secondaryLabel', 'Lien secondaire', 60),
                static::link('secondaryUrl', 'Adresse du lien secondaire', '/produits')->columnSpanFull(),
                Toggle::make('showContact')->label('Boutons Appeler et WhatsApp')->default(true)->columnSpanFull(),
            ])->columns(self::GRID),
            Block::make('categories')->label(self::blockLabel('categories'))->icon('heroicon-o-rectangle-group')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                ...static::tr('subtitle', 'Sous-titre', 300, area: true),
                Select::make('slugs')->label('Catégories')->multiple()->searchable()->maxItems(12)->columnSpanFull()
                    ->options(fn () => Category::where('active', true)->orderBy('sortOrder')->orderBy('id')->pluck('label', 'slug')->all())
                    ->helperText('Dans l’ordre choisi. Vide = toutes les catégories principales publiées.'),
            ])->columns(self::GRID),
            Block::make('usps')->label(self::blockLabel('usps'))->icon('heroicon-o-check-badge')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                ...static::tr('subtitle', 'Sous-titre', 300, area: true),
                static::repeater('items', 'Arguments', 8, [
                    static::icon()->default('badge-check')->columnSpanFull(),
                    ...static::tr('title', 'Titre', 80, required: true),
                    ...static::tr('text', 'Texte', 300, area: true),
                ], 'Ajouter un argument', 'title'),
            ])->columns(self::GRID),
            Block::make('references')->label(self::blockLabel('references'))->icon('heroicon-o-building-office-2')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                ...static::tr('subtitle', 'Sous-titre', 300, area: true),
                static::repeater('logos', 'Logos', 24, [
                    TextInput::make('name')->label('Nom du client')->required()->maxLength(80),
                    static::link('url', 'Site (facultatif)', 'https://'),
                    $legacyImage('image', 'Logo')->required()->columnSpanFull(),
                ], 'Ajouter un logo', 'name'),
            ])->columns(self::GRID),
            Block::make('testimonials')->label(self::blockLabel('testimonials'))->icon('heroicon-o-chat-bubble-left-right')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                ...static::tr('subtitle', 'Sous-titre', 300, area: true),
                static::repeater('items', 'Témoignages', 12, [
                    ...static::tr('quote', 'Témoignage', 600, area: true, required: true),
                    TextInput::make('author')->label('Nom')->required()->maxLength(80)->columnSpanFull(),
                    ...static::tr('role', 'Fonction / entreprise', 120),
                ], 'Ajouter un témoignage', 'author'),
            ])->columns(self::GRID),
            Block::make('blog')->label(self::blockLabel('blog'))->icon('heroicon-o-newspaper')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                Select::make('count')->label('Nombre d’articles')->options([1 => '1', 2 => '2', 3 => '3', 4 => '4', 6 => '6'])->default(3)->native(false),
            ])->columns(self::GRID),
            Block::make('text')->label(self::blockLabel('text'))->icon('heroicon-o-document-text')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                ...static::tr('body', 'Texte (une ligne vide sépare les paragraphes)', 8000, area: true, required: true),
            ])->columns(self::GRID),
            Block::make('faq')->label(self::blockLabel('faq'))->icon('heroicon-o-question-mark-circle')->schema([
                static::enabled(),
                ...static::tr('title', 'Titre', 120),
                static::repeater('items', 'Questions', 30, [
                    ...static::tr('q', 'Question', 200, required: true),
                    ...static::tr('a', 'Réponse', 1500, area: true, required: true),
                ], 'Ajouter une question', 'q'),
            ])->columns(self::GRID),
        ];
    }

    /** Pre-filled sections for a new home page: the client's model. */
    public static function defaultSections(): array
    {
        return HomeTemplate::sections();
    }

    public static function table(Table $table): Table
    {
        return ContentLayout::table(parent::table($table));
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListHomepages::route('/'),
            'create' => Pages\CreateHomepage::route('/create'),
            'edit' => Pages\EditHomepage::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ! static::getEloquentQuery()->exists();
    }
}
