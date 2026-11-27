<?php

namespace App\Filament\Resources\ShopSettings;

use App\Filament\Resources\Cmi\CmiResource;
use App\Filament\Resources\SystemConfigResource;
use App\Models\ShippingCity;
use App\Services\CheckoutSettings;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class ShopSettingsResource extends SystemConfigResource
{
    public static string $configName = 'shop';

    protected static ?string $slug = 'shopsettings';

    protected static ?string $navigationLabel = 'Réglages boutique';

    protected static ?string $modelLabel = 'Réglages boutique';

    protected static ?string $pluralModelLabel = 'Réglages boutique';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    /** Prices (master switch) + payment methods offered at checkout. Values are checked again in SystemConfig::saveForm(). */
    public static function form(Schema $s): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];
        $cmiOn = CheckoutSettings::cmiReady();

        return $s->components([
            Callout::make('À savoir')->description(static::definition()['notice'])->warning()->columnSpanFull(),
            Section::make('Prix sur le site')
                ->description('Interrupteur général. Désactivé : aucun prix sur le site, chaque produit passe en « Demander un devis ». Activé : chaque produit suit son mode de vente (Produits › Prix & stock).')
                ->schema([Toggle::make('fields.showPrices')->label('Afficher les prix et permettre la commande en ligne')->default(false)])
                ->columnSpanFull(),
            Section::make('Virement bancaire')
                ->description('Le RIB est affiché au client après la commande ; il dépose ensuite son justificatif. Champs vides : valeurs du fichier .env (FAW_BANK_*), sinon « communiqué par FAW ».')
                ->schema([
                    Toggle::make('fields.bankTransferEnabled')->label('Proposer le virement bancaire')->default(true)->columnSpanFull(),
                    TextInput::make('fields.bankHolder')->label('Titulaire du compte')->maxLength(120),
                    TextInput::make('fields.bankName')->label('Banque')->maxLength(120),
                    TextInput::make('fields.bankBranch')->label('Agence')->maxLength(120),
                    TextInput::make('fields.bankRib')->label('RIB (24 chiffres)')->regex('/^[\d\s]{24,35}$/')->helperText('24 chiffres, espaces acceptés.'),
                    TextInput::make('fields.bankIban')->label('IBAN')->maxLength(40)->regex('/^[A-Z]{2}[0-9A-Z\s]{10,40}$/i'),
                    TextInput::make('fields.bankSwift')->label('Code SWIFT / BIC')->maxLength(11)->regex('/^[A-Z0-9]{8}(?:[A-Z0-9]{3})?$/i'),
                ])->columns($grid)->columnSpanFull(),
            Section::make('Paiement à la livraison / au retrait')
                ->description('Le client règle à la réception. Limites facultatives : montant maximum et villes autorisées (le retrait au dépôt reste toujours possible).')
                ->schema([
                    Toggle::make('fields.codEnabled')->label('Proposer le paiement à la livraison / au retrait')->default(true)->columnSpanFull(),
                    TextInput::make('fields.codMaxAmount')->label('Montant maximum TTC (DH)')->integer()->minValue(1)->maxValue(100000000)->nullable()->helperText('Vide = sans limite.'),
                    Select::make('fields.codCities')->label('Villes autorisées')->multiple()->options(fn () => ShippingCity::orderBy('sortOrder')->orderBy('name')->pluck('name', 'slug')->all())->helperText('Vide = toutes les villes de livraison.'),
                ])->columns($grid)->columnSpanFull(),
            Section::make('Carte bancaire (CMI)')
                ->description('Réglée sur la page « Paiement CMI ».')
                ->schema([
                    Callout::make($cmiOn ? 'Paiement par carte proposé aux clients' : 'Paiement par carte désactivé')
                        ->description($cmiOn ? 'Les clients peuvent payer par carte via la page sécurisée du CMI.' : 'Aucune option carte n’apparaît sur le site. Activation réservée au propriétaire, identifiants CMI complets requis.')
                        ->{$cmiOn ? 'success' : 'info'}()
                        ->actions([\Filament\Actions\Action::make('cmi')->label('Ouvrir « Paiement CMI »')->url(fn () => CmiResource::getUrl())->link()]),
                ])->columnSpanFull(),
        ])->columns(1);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditShopSettings::route('/'),
            'edit' => Pages\EditShopSettings::route('/{record}/edit'),
        ];
    }
}
