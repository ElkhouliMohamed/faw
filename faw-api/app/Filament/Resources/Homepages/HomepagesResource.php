<?php

namespace App\Filament\Resources\Homepages;

use App\Filament\Resources\ContentPages\ContentLayout;
use App\Filament\Resources\ContentResource;
use App\Models\Category;
use App\Models\Media;
use App\Models\Product;
use App\Services\HomeSections;
use Filament\Forms\Components\Builder;
use Filament\Forms\Components\Builder\Block;
use Filament\Forms\Components\Hidden;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Tabs;
use Filament\Schemas\Components\Tabs\Tab;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

/**
 * The home page is a single record (the list redirects to it once it exists, see ListHomepages).
 * Its sections are a Builder: ordered, each one can be hidden without being deleted.
 * Without a published home record the storefront shows its built-in default home.
 */
class HomepagesResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Accueil';

    protected static ?string $modelLabel = 'page d’accueil';

    protected static ?string $pluralModelLabel = 'Accueil';

    protected static ?string $slug = 'homepages';

    public static string $contentKind = 'home';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Tabs::make('Accueil')->tabs([
                Tab::make('Sections')->icon('heroicon-o-squares-2x2')->schema([
                    Section::make('Sections de la page d’accueil')
                        ->description('Affichées dans cet ordre. Glissez pour réordonner ; décochez « Afficher » pour masquer une section sans la supprimer.')
                        ->schema([static::sectionsBuilder()]),
                ]),
                Tab::make('Réglages & SEO')->icon('heroicon-o-globe-alt')->schema([
                    Section::make('Page')
                        ->description('Titre de l’onglet du navigateur et texte de repli si aucune bannière n’est définie.')
                        ->schema([
                            TextInput::make('title')->label('Titre de la page')->required()->maxLength(120)->default('Accueil'),
                            Textarea::make('excerpt')->label('Sous-titre de repli')->maxLength(1000)->rows(2),
                            TextInput::make('slug')->label('Identifiant URL')->default('accueil')->disabled()->dehydrated()->required(),
                            Hidden::make('kind')->default('home')->dehydrateStateUsing(fn () => 'home'),
                            Toggle::make('published')->label('Publié')->default(true)
                                ->helperText('Non publié : le site affiche l’accueil par défaut.'),
                        ])->columns($grid),
                    Section::make('Référencement')
                        ->description('Titre et description proposés à Google. Vides = valeurs générales du site.')
                        ->schema([
                            TextInput::make('seoTitle')->label('Titre SEO')->maxLength(160),
                            Textarea::make('seoDescription')->label('Description SEO')->maxLength(320)->rows(3),
                        ])->columns($grid),
                ]),
            ])->persistTabInQueryString()->columnSpanFull(),
        ])->columns(1);
    }

    public static function sectionsBuilder(): Builder
    {
        $enabled = fn () => Toggle::make('enabled')->label('Afficher cette section')->default(true)->columnSpanFull();
        $title = fn (string $placeholder = '') => TextInput::make('title')->label('Titre')->maxLength(120)->placeholder($placeholder);
        $subtitle = fn () => Textarea::make('subtitle')->label('Sous-titre')->maxLength(300)->rows(2);
        $link = fn (string $name, string $label) => TextInput::make($name)->label($label)->maxLength(500)->regex(HomeSections::LINK)->placeholder('/devis')
            ->helperText('Lien interne (/…) ou adresse https://.');
        $image = fn (string $name = 'image', string $label = 'Image') => TextInput::make($name)->label($label)->maxLength(500)->regex(HomeSections::IMAGE)
            ->placeholder('/storage/media/photo.webp')->datalist(fn () => Media::query()->orderByDesc('id')->limit(200)->pluck('url')->filter()->values()->all())
            ->helperText('Chemin copié depuis la Médiathèque (/storage/…) ou /images/…');
        $label = fn (string $type) => fn (?array $state): string => HomeSections::TYPES[$type]
            .(filled($state['title'] ?? null) ? ' — '.$state['title'] : '')
            .(($state['enabled'] ?? true) ? '' : ' (masquée)');

        return Builder::make('blocks')->hiddenLabel()->blocks([
            Block::make('hero')->label($label('hero'))->icon('heroicon-o-photo')->schema([
                $enabled(),
                TextInput::make('eyebrow')->label('Sur-titre')->maxLength(80)->placeholder('FAW · Casablanca'),
                TextInput::make('title')->label('Titre (H1)')->required()->maxLength(140),
                Textarea::make('subtitle')->label('Texte')->maxLength(400)->rows(3)->columnSpanFull(),
                $image(),
                TextInput::make('imageAlt')->label('Description de l’image')->maxLength(160),
                TextInput::make('primaryLabel')->label('Bouton principal')->maxLength(40)->placeholder('Demander un devis'),
                $link('primaryUrl', 'Lien du bouton principal'),
                TextInput::make('secondaryLabel')->label('Lien secondaire')->maxLength(60)->placeholder('Voir les portes coupe-feu'),
                $link('secondaryUrl', 'Adresse du lien secondaire')->placeholder('/produits'),
                Toggle::make('showContact')->label('Boutons Appeler et WhatsApp')->default(true)->columnSpanFull(),
            ])->columns(2),
            Block::make('categories')->label($label('categories'))->icon('heroicon-o-rectangle-group')->schema([
                $enabled(),
                $title('Nos produits'),
                $subtitle(),
                Select::make('slugs')->label('Catégories')->multiple()->searchable()->maxItems(12)->columnSpanFull()
                    ->options(fn () => Category::where('active', true)->orderBy('sortOrder')->orderBy('id')->pluck('label', 'slug')->all())
                    ->helperText('Dans l’ordre choisi. Vide = toutes les catégories principales publiées.'),
            ])->columns(2),
            Block::make('products')->label($label('products'))->icon('heroicon-o-cube')->schema([
                $enabled(),
                $title('Produits phares'),
                $subtitle(),
                Select::make('ids')->label('Produits')->multiple()->searchable()->maxItems(12)->columnSpanFull()
                    ->options(fn () => Product::where('active', true)->orderBy('title')->pluck('title', 'id')->all())
                    ->helperText('Prix affiché ou « Demander un devis » selon le produit et les réglages de prix.'),
                TextInput::make('linkLabel')->label('Lien « tout voir »')->maxLength(40)->placeholder('Voir la boutique'),
                $link('linkUrl', 'Adresse du lien')->placeholder('/produits'),
            ])->columns(2),
            Block::make('usps')->label($label('usps'))->icon('heroicon-o-check-badge')->schema([
                $enabled(),
                $title('Pourquoi FAW'),
                $subtitle(),
                Repeater::make('items')->label('Arguments')->schema([
                    Select::make('icon')->label('Icône')->options(HomeSections::ICONS)->default('badge')->native(false),
                    TextInput::make('title')->label('Titre')->required()->maxLength(80),
                    Textarea::make('text')->label('Texte')->maxLength(300)->rows(2)->columnSpanFull(),
                ])->columns(2)->maxItems(8)->reorderable()->collapsible()->addActionLabel('Ajouter un argument')->columnSpanFull(),
            ])->columns(2),
            Block::make('references')->label($label('references'))->icon('heroicon-o-building-office-2')->schema([
                $enabled(),
                $title('Ils nous font confiance'),
                $subtitle(),
                Repeater::make('logos')->label('Logos')->schema([
                    TextInput::make('name')->label('Nom du client')->required()->maxLength(80),
                    $image('image', 'Logo')->required(),
                    $link('url', 'Site (facultatif)')->placeholder('https://'),
                ])->columns(3)->maxItems(24)->reorderable()->collapsible()->addActionLabel('Ajouter un logo')->columnSpanFull(),
            ])->columns(2),
            Block::make('testimonials')->label($label('testimonials'))->icon('heroicon-o-chat-bubble-left-right')->schema([
                $enabled(),
                $title('Ce que disent nos clients'),
                $subtitle(),
                Repeater::make('items')->label('Témoignages')->schema([
                    Textarea::make('quote')->label('Témoignage')->required()->maxLength(600)->rows(3)->columnSpanFull(),
                    TextInput::make('author')->label('Nom')->required()->maxLength(80),
                    TextInput::make('role')->label('Fonction / entreprise')->maxLength(120),
                ])->columns(2)->maxItems(12)->reorderable()->collapsible()->addActionLabel('Ajouter un témoignage')->columnSpanFull(),
            ])->columns(2),
            Block::make('cta')->label($label('cta'))->icon('heroicon-o-megaphone')->schema([
                $enabled(),
                TextInput::make('title')->label('Titre')->required()->maxLength(120),
                Textarea::make('text')->label('Texte')->maxLength(400)->rows(2),
                TextInput::make('label')->label('Bouton')->required()->maxLength(40)->default('Demander un devis'),
                $link('url', 'Lien du bouton')->required()->default('/devis'),
                Toggle::make('showWhatsapp')->label('Bouton WhatsApp')->default(true),
            ])->columns(2),
            Block::make('blog')->label($label('blog'))->icon('heroicon-o-newspaper')->schema([
                $enabled(),
                $title('Conseils et actualités'),
                Select::make('count')->label('Nombre d’articles')->options([1 => '1', 2 => '2', 3 => '3', 4 => '4', 6 => '6'])->default(3)->native(false),
            ])->columns(2),
            Block::make('text')->label($label('text'))->icon('heroicon-o-document-text')->schema([
                $enabled(),
                $title(),
                Textarea::make('body')->label('Texte')->required()->maxLength(8000)->rows(6)->columnSpanFull()
                    ->helperText('Texte brut : une ligne vide sépare les paragraphes.'),
            ])->columns(2),
            Block::make('faq')->label($label('faq'))->icon('heroicon-o-question-mark-circle')->schema([
                $enabled(),
                $title('Questions fréquentes'),
                Repeater::make('items')->label('Questions')->schema([
                    TextInput::make('q')->label('Question')->required()->maxLength(200),
                    Textarea::make('a')->label('Réponse')->required()->maxLength(1500)->rows(3),
                ])->maxItems(30)->reorderable()->collapsible()->addActionLabel('Ajouter une question')->columnSpanFull(),
            ])->columns(2),
        ])
            ->default(static::defaultSections())
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

    /** Pre-filled sections for a new home page: the current default home of the storefront. */
    public static function defaultSections(): array
    {
        return [
            ['type' => 'hero', 'data' => [
                'enabled' => true, 'eyebrow' => 'FAW · Casablanca', 'title' => 'Portes coupe-feu',
                'subtitle' => 'Des portes coupe-feu pour vos bâtiments, à Casablanca. Pour connaître le prix, demandez un devis. Vous pouvez aussi nous appeler.',
                'image' => '/images/products/v7-2/CF-EI60-100-photo.jpg', 'imageAlt' => 'Porte coupe-feu un vantail FAW, photo sur fond clair',
                'primaryLabel' => 'Demander un devis', 'primaryUrl' => '/devis', 'secondaryLabel' => 'Voir les portes coupe-feu', 'secondaryUrl' => '/produits/portes-coupe-feu', 'showContact' => true,
            ]],
            ['type' => 'categories', 'data' => ['enabled' => true, 'title' => 'Nos autres produits', 'subtitle' => '', 'slugs' => ['galandage', 'incendie', 'automatisme']]],
            ['type' => 'usps', 'data' => ['enabled' => true, 'title' => 'Pourquoi FAW', 'subtitle' => '', 'items' => [
                ['icon' => 'file', 'title' => 'Prix sur devis', 'text' => 'Devis PDF avec totaux HT et TTC (TVA 20 %), envoyé par e-mail.'],
                ['icon' => 'warehouse', 'title' => 'Retrait au dépôt', 'text' => 'Retrait gratuit au dépôt de Lakhyayta, ou livraison selon la ville.'],
                ['icon' => 'building', 'title' => 'Entreprises et particuliers', 'text' => 'Chantiers, installateurs, bureaux d’études : indiquez votre ICE dans la demande.'],
            ]]],
            ['type' => 'cta', 'data' => ['enabled' => true, 'title' => 'Un chantier, une grande quantité ?', 'text' => 'Sur-mesure possible en grande quantité : délai précisé sur le devis. Envoyez-nous votre liste, nous revenons vers vous.', 'label' => 'Demander un devis', 'url' => '/devis', 'showWhatsapp' => true]],
        ];
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
