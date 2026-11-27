<?php

namespace App\Filament\Resources;

use App\Filament\Resources\LandingPages\LandingPageResource;
use App\Models\BlogCategory;
use App\Models\BlogTag;
use App\Models\ContentPage;
use App\Models\Product;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\DateTimePicker;
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
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

/**
 * Shared CMS resource (pages, blog, technologies, homepage), scoped by ContentPage.kind.
 *
 * Works with full-page List/Create/Edit pages and with legacy Manage pages:
 * the EditAction opens the edit page when the subclass registers one, and the
 * hidden `kind` field always stores this resource's kind on create.
 */
abstract class ContentResource extends OwnerResource
{
    protected static ?string $model = ContentPage::class;

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    public static string $contentKind = 'page';

    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->where('kind', static::$contentKind);
    }

    /** The "Sections" repeater is defined once, on the landing-page resource. */
    protected static function blocksRepeater(): ?Repeater
    {
        return LandingPageResource::blocksRepeater();
    }

    public static function form(Schema $schema): Schema
    {
        $blocks = static::blocksRepeater();
        $home = static::$contentKind === 'home';
        $blog = static::$contentKind === 'blog';
        $grid = ['default' => 1, 'lg' => 2];
        $kind = static::$contentKind;

        $tabs = [
            Tab::make('Contenu')->icon('heroicon-o-document-text')->schema([
                Section::make($home ? 'Bannière d’accueil' : 'Identité')
                    ->description($home ? 'Texte et visuel affichés en haut de la page d’accueil.' : 'Titre, adresse et résumé affichés sur le site et dans les listes.')
                    ->schema([
                        TextInput::make('slug')->label('Identifiant URL')->required()->regex('/^[a-z0-9-]+$/')->maxLength(160)->unique(modifyRuleUsing: fn ($rule) => $rule->where('kind', static::$contentKind), ignoreRecord: true)->default($home ? 'accueil' : null)->disabled($home)->dehydrated()->helperText($home ? 'Adresse fixe de la page d’accueil.' : 'Minuscules, chiffres et tirets uniquement, ex. portes-coupe-feu.'),
                        TextInput::make('title')->label($home ? 'Titre de la bannière' : 'Titre')->required()->maxLength(120),
                        Textarea::make('excerpt')->label($home ? 'Sous-titre' : 'Résumé')->maxLength(1000)->rows(3)->columnSpanFull()->helperText($home ? null : 'Quelques phrases affichées dans les listes et les aperçus.'),
                        TextInput::make('image')->label('Image locale')->regex('#^/(?:images|storage)/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$#i')->maxLength(500)->placeholder('/images/exemple.jpg')->helperText('Chemin local commençant par /images/ ou /storage/ (png, jpg, webp, gif, avif).'),
                        Hidden::make('kind')->default($kind)->dehydrateStateUsing(fn () => $kind),
                    ])->columns($grid),
                Section::make('Mise en avant')
                    ->description('Produit et bouton d’action affichés dans la bannière.')
                    ->schema([
                        Select::make('featuredProductId')->label('Produit vedette')->options(fn () => Product::pluck('title', 'id')->all())->searchable(),
                        TextInput::make('ctaLabel')->label('Libellé du bouton')->maxLength(40)->placeholder('Demander un devis'),
                        TextInput::make('ctaUrl')->label('Lien du bouton')->regex('#^/(?!/)[^<>\\\\]*$#')->maxLength(500)->placeholder('/devis')->helperText('Lien interne commençant par /.'),
                        Toggle::make('defaultSections')->label('Conserver les sections actuelles sous la bannière')->default(true),
                    ])->columns($grid)->visible($home),
                Section::make('Texte de la page')
                    ->schema([
                        Textarea::make('bodyHtml')->label('Contenu HTML (nettoyé)')->rows(12)->maxLength(100000)->columnSpanFull()->helperText('Balises de texte, liens et tableaux uniquement. Scripts, styles, iframes et attributs actifs supprimés.'),
                    ])->visible(! $home),
            ]),
        ];
        if ($blocks) {
            $tabs[] = Tab::make('Sections')->icon('heroicon-o-squares-2x2')->schema([
                Section::make('Sections de la page')->description('Blocs affichés dans l’ordre : bannière, texte, produits, FAQ, appel à action. Glissez pour réordonner.')->schema([$blocks]),
            ]);
        }
        $tabs[] = Tab::make('Classement')->icon('heroicon-o-tag')->visible($blog)->schema([
            Section::make('Catégorie et étiquettes')->description('Aide les visiteurs à retrouver l’article sur le blog.')->schema([
                Select::make('categoryId')->label('Catégorie du blog')->options(fn () => BlogCategory::where('active', true)->pluck('label', 'id')->all()),
                Select::make('tags')->label('Étiquettes')->multiple()->options(fn () => BlogTag::where('active', true)->pluck('label', 'id')->all()),
            ])->columns($grid),
        ]);
        $tabs[] = Tab::make('SEO & publication')->icon('heroicon-o-globe-alt')->schema([
            Section::make('Référencement')->description('Titre et description affichés par Google. Laissez vide pour reprendre le titre et le résumé.')->schema([
                TextInput::make('seoTitle')->label('Titre SEO')->maxLength(160)->helperText('Idéalement moins de 60 caractères.'),
                Textarea::make('seoDescription')->label('Description SEO')->maxLength(320)->rows(3)->helperText('Idéalement 120 à 160 caractères.'),
            ])->columns($grid),
            Section::make('Publication')->description('Le contenu n’est visible sur le site que s’il est publié et que la date de publication est passée.')->schema([
                Toggle::make('published')->label('Publié')->default(false),
                DateTimePicker::make('publishedAt')->label('Publication différée (facultative)')->seconds(false)->helperText('Laisser vide pour publier immédiatement.'),
            ])->columns($grid),
        ]);
        $tabs[] = Tab::make('Traduction arabe')->icon('heroicon-o-language')->schema([
            Section::make('Contenu en arabe (facultatif)')
                ->description('Affiché lorsque le visiteur consulte le site en arabe.')
                ->schema([
                    TextInput::make('title_ar')->label('Titre (arabe)')->maxLength(120)->extraInputAttributes(['dir' => 'rtl']),
                    TextInput::make('ctaLabel_ar')->label('Libellé du bouton (arabe)')->maxLength(40)->extraInputAttributes(['dir' => 'rtl'])->visible($home),
                    Textarea::make('excerpt_ar')->label($home ? 'Sous-titre (arabe)' : 'Résumé (arabe)')->maxLength(1000)->rows(3)->columnSpanFull()->extraInputAttributes(['dir' => 'rtl']),
                    Textarea::make('bodyHtml_ar')->label('Contenu HTML en arabe')->rows(10)->maxLength(100000)->columnSpanFull()->extraInputAttributes(['dir' => 'rtl'])->visible(! $home),
                    TextInput::make('seoTitle_ar')->label('Titre SEO (arabe)')->maxLength(160)->extraInputAttributes(['dir' => 'rtl']),
                    Textarea::make('seoDescription_ar')->label('Description SEO (arabe)')->maxLength(320)->rows(3)->extraInputAttributes(['dir' => 'rtl']),
                ])->columns($grid),
        ]);

        return $schema->components([
            Tabs::make('Contenu')->tabs($tabs)->columnSpanFull(),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')->label('Titre')->searchable()->sortable()->wrap(),
                TextColumn::make('slug')->label('URL')->searchable()->toggleable(),
                IconColumn::make('published')->label('Publié')->boolean()->sortable(),
                TextColumn::make('updated_at')->label('Modifié')->dateTime('d/m/Y H:i')->sortable(),
            ])
            ->defaultSort('updated_at', 'desc')
            ->filters([
                TernaryFilter::make('published')->label('Publication')->placeholder('Tous')->trueLabel('Publiés')->falseLabel('Brouillons'),
            ])
            ->recordActions([
                EditAction::make(),
                Action::make('preview')->label('Voir sur le site')->icon('heroicon-o-arrow-top-right-on-square')->color('gray')->visible(fn ($record) => $record->published)->url(fn ($record) => $record->kind === 'home' ? '/' : '/'.match ($record->kind) {
                    'page' => 'pages','technology' => 'technologies',default => 'blog'
                }.'/'.$record->slug)->openUrlInNewTab(),
                DeleteAction::make(),
            ]);
    }
}
