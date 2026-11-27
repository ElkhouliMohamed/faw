<?php

namespace App\Filament\Resources\SiteLayouts;

use App\Filament\Resources\Homepages\HomepagesResource as Home;
use App\Filament\Resources\SystemConfigResource;
use App\Models\SiteMenu;
use App\Services\SiteLayout;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

/**
 * Header and footer of the storefront: top bar, header button, footer texts (SystemConfig "layout").
 * Navigation links live in "Menus du site"; phones, e-mail, address, hours and social links in "Coordonnées & réseaux sociaux".
 */
class SiteLayoutResource extends SystemConfigResource
{
    public static string $configName = 'layout';

    protected static ?string $slug = 'site-layout';

    protected static ?string $navigationLabel = SiteLayout::LABEL;

    protected static ?string $modelLabel = SiteLayout::LABEL;

    protected static ?string $pluralModelLabel = SiteLayout::LABEL;

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    protected static string|\BackedEnum|null $navigationIcon = 'heroicon-o-window';

    private const GRID = ['default' => 1, 'lg' => 2];

    public static function form(Schema $s): Schema
    {
        $link = fn (string $name, string $label, string $placeholder) => TextInput::make($name)->label($label)->maxLength(500)->regex(SiteMenu::LINK)->placeholder($placeholder)
            ->helperText('Lien interne (/devis), https://, tel:+212… ou mailto:… Vide = pas de lien.')
            ->validationMessages(['regex' => 'Lien interne commençant par /, adresse https://, tel: ou mailto:.']);

        return $s->components([
            Callout::make('Où modifier le reste')
                ->description('Liens du menu (Accueil, Produits ▾, Solutions…) et colonnes du pied de page : Contenu › Menus du site. Téléphones, WhatsApp, e-mail, adresse, horaires et réseaux sociaux : Paramètres › Coordonnées, réseaux sociaux & bouton flottant. Logo : Paramètres › Thèmes.')
                ->info()->columnSpanFull(),
            Section::make('Bandeau du haut (brun)')
                ->description('Trois messages courts conseillés, avec une icône. Colonne de gauche : français ; droite : arabe.')
                ->schema([
                    Toggle::make('fields.topbarEnabled')->label('Afficher le bandeau')->default(true)->columnSpanFull(),
                    Repeater::make('fields.topbar')->label('Messages')->schema([
                        Home::icon()->columnSpanFull(),
                        ...Home::tr('text', 'Texte', 90, required: true),
                        $link('url', 'Lien (facultatif)', '/devis')->columnSpanFull(),
                    ])->columns(self::GRID)->maxItems(4)->reorderable()->collapsible()->cloneable()
                        ->itemLabel(fn (array $state): ?string => filled($state['text'] ?? null) ? (string) $state['text'] : null)
                        ->addActionLabel('Ajouter un message')->columnSpanFull(),
                ])->columns(self::GRID)->columnSpanFull(),
            Section::make('Bouton orange de l’en-tête')
                ->description('À droite du menu. Le numéro affiché au-dessus du texte est le téléphone des coordonnées du site.')
                ->schema([
                    Toggle::make('fields.headerCtaEnabled')->label('Afficher le bouton')->default(true),
                    Toggle::make('fields.headerCtaShowPhone')->label('Afficher le numéro de téléphone dans le bouton')->default(true),
                    ...Home::tr('fields.headerCtaLabel', 'Texte du bouton', 40, placeholder: 'Demander un devis'),
                    $link('fields.headerCtaUrl', 'Lien du bouton', '/devis'),
                    Home::icon('fields.headerCtaIcon'),
                ])->columns(self::GRID)->columnSpanFull(),
            Section::make('Pied de page')
                ->description('Texte sous le logo, titre de la colonne Contact et ligne de copyright ({year} = année en cours).')
                ->schema([
                    ...Home::tr('fields.footerText', 'Texte sous le logo', 300, area: true),
                    ...Home::tr('fields.footerContactTitle', 'Titre de la colonne contact', 40, placeholder: 'Contact'),
                    ...Home::tr('fields.copyright', 'Copyright', 160, placeholder: '© {year} FAW Aluminium. Tous droits réservés.'),
                ])->columns(self::GRID)->columnSpanFull(),
        ])->columns(1);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditSiteLayout::route('/'),
            'edit' => Pages\EditSiteLayout::route('/{record}/edit'),
        ];
    }
}
