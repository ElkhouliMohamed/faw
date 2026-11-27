<?php

namespace App\Filament\Resources\LandingPages;

use App\Filament\Resources\OwnerResource;
use App\Models\LandingPage;
use App\Models\Product;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class LandingPageResource extends OwnerResource
{
    protected static ?string $model = LandingPage::class;

    protected static ?string $slug = 'landingpages';

    protected static ?string $navigationLabel = 'Landing pages';

    protected static ?string $modelLabel = 'landing page';

    protected static ?string $pluralModelLabel = 'Landing pages';

    protected static ?string $recordTitleAttribute = 'title';

    protected static string|\UnitEnum|null $navigationGroup = 'Marketing & SEO';

    public const BLOCK_TYPES = ['hero' => 'Bannière', 'text' => 'Texte', 'products' => 'Produits', 'faq' => 'FAQ', 'cta' => 'Appel à action'];

    /**
     * The "Sections" repeater. It must stay a top-level component of form():
     * ContentResource (home, pages, technologies, blog) reuses it from there.
     */
    public static function blocksRepeater(): Repeater
    {
        $for = fn (string ...$types) => fn (Get $get): bool => in_array($get('type'), $types, true);

        return Repeater::make('blocks')->label('Sections')->schema([
            Select::make('type')->label('Bloc')->options(self::BLOCK_TYPES)->required()->live()
                ->helperText('Choisir le type de section : les champs utiles s’affichent ensuite.')
                ->columnSpanFull(),
            TextInput::make('title')->label('Titre')->columnSpanFull(),
            Textarea::make('body')->label('Texte')->rows(5)->columnSpanFull()->visible($for('text')),
            Textarea::make('subtitle')->label('Sous-titre')->columnSpanFull()->visible($for('hero')),
            Textarea::make('text')->label('Texte CTA')->columnSpanFull()->visible($for('cta')),
            TextInput::make('ctaLabel')->label('Bouton bannière')->visible($for('hero')),
            TextInput::make('ctaUrl')->label('Lien bannière')->regex('#^/(?!/)[^<>]*$#')->helperText('Lien interne commençant par /, ex. /devis.')->visible($for('hero')),
            TextInput::make('image')->label('Image (chemin local)')->regex('#^/(?:images|storage)/[a-zA-Z0-9_./-]+\\.(?:png|jpe?g|webp|gif|avif)$#i')->helperText('Chemin copié depuis la médiathèque, ex. /storage/media/photo.webp.')->columnSpanFull()->visible($for('hero')),
            TextInput::make('label')->label('Libellé du bouton')->visible($for('cta')),
            TextInput::make('url')->label('Lien CTA')->regex('#^/(?!/)[^<>]*$#')->helperText('Lien interne commençant par /, ex. /contact.')->visible($for('cta')),
            Select::make('ids')->label('Produits')->options(Product::pluck('title', 'id')->all())->multiple()->searchable()->columnSpanFull()->visible($for('products')),
            Repeater::make('items')->label('Questions')->schema([TextInput::make('q')->label('Question'), Textarea::make('a')->label('Réponse')])->addActionLabel('Ajouter une question')->columnSpanFull()->visible($for('faq')),
        ])
            ->columns(2)
            ->maxItems(30)
            ->collapsible()
            ->itemLabel(fn (array $state): string => (self::BLOCK_TYPES[$state['type'] ?? ''] ?? 'Nouvelle section').(filled($state['title'] ?? null) ? ' — '.$state['title'] : ''))
            ->addActionLabel('Ajouter une section')
            ->helperText('Les sections s’affichent dans cet ordre sur la page. Glisser pour réordonner (30 maximum).')
            ->columnSpanFull();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Page')
                ->description('Adresse, titre et publication de la landing page (page de campagne accessible via /l/...).')
                ->schema([
                    TextInput::make('title')->label('Titre')->maxLength(255)->required(),
                    TextInput::make('slug')->label('URL /l/...')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true)
                        ->helperText('Minuscules, chiffres et tirets uniquement, ex. promo-portes-coupe-feu.'),
                    Toggle::make('published')->label('Publiée')->default(false)
                        ->helperText('Non publiée : la page n’est pas accessible au public.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
            Section::make('Référencement (SEO)')
                ->description('Titre et description proposés à Google.')
                ->schema([
                    TextInput::make('seoTitle')->label('Titre SEO')->maxLength(255)->columnSpanFull(),
                    Textarea::make('seoDescription')->label('Description SEO')->maxLength(12000)->columnSpanFull(),
                ])
                ->collapsible()
                ->columnSpanFull(),
            Section::make('Traduction arabe')
                ->description('Titre et référencement en arabe pour la version RTL.')
                ->schema([
                    TextInput::make('title_ar')->label('Titre en arabe')->maxLength(255)->extraInputAttributes(['dir' => 'rtl'])->columnSpanFull(),
                    TextInput::make('seoTitle_ar')->label('Titre SEO en arabe')->maxLength(255)->extraInputAttributes(['dir' => 'rtl'])->columnSpanFull(),
                    Textarea::make('seoDescription_ar')->label('Description SEO en arabe')->maxLength(12000)->extraInputAttributes(['dir' => 'rtl'])->columnSpanFull(),
                ])
                ->collapsible()
                ->collapsed()
                ->columnSpanFull(),
            static::blocksRepeater(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('title')->label('Page')->searchable()->sortable(),
                TextColumn::make('slug')->label('URL')->searchable(),
                IconColumn::make('published')->label('Publiée')->boolean(),
            ])
            ->filters([TernaryFilter::make('published')->label('Publiée')])
            ->defaultSort('id', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListLandingPages::route('/'),
            'create' => Pages\CreateLandingPage::route('/create'),
            'edit' => Pages\EditLandingPage::route('/{record}/edit'),
        ];
    }
}
