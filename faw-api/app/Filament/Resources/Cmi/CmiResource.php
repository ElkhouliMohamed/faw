<?php

namespace App\Filament\Resources\Cmi;

use App\Filament\Resources\SystemConfigResource;
use App\Models\User;
use App\Services\CheckoutSettings;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Callout;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class CmiResource extends SystemConfigResource
{
    public static string $configName = 'cmi';

    protected static ?string $slug = 'cmi';

    protected static ?string $navigationLabel = 'Paiement CMI';

    protected static ?string $modelLabel = 'Paiement CMI';

    protected static ?string $pluralModelLabel = 'Paiement CMI';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    protected static function owner(): bool
    {
        $u = auth()->user();

        return $u instanceof User && $u->canDo('*');
    }

    /**
     * Card payment stays OFF by default. The switch is editable by the owner (super admin) only and is forced off by
     * SystemConfig::saveForm() unless the client id, store key and gateway URL are all set.
     */
    public static function form(Schema $s): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];
        $ready = CheckoutSettings::cmiReady();

        return $s->components([
            Callout::make($ready ? 'Paiement par carte ACTIVÉ' : 'Paiement par carte désactivé')
                ->description(static::definition()['notice'])
                ->{$ready ? 'success' : 'warning'}()->columnSpanFull(),
            Section::make('Activation')
                ->description('URL de notification à déclarer auprès du CMI : /api/payments/cmi/callback sur l’adresse publique de la boutique. Le paiement n’est confirmé que par cette notification signée.')
                ->schema([
                    Toggle::make('fields.enabled')->label('Proposer le paiement par carte (CMI)')->default(false)
                        ->disabled(fn () => ! static::owner())
                        ->helperText(fn () => static::owner() ? 'Reste désactivé tant que les trois identifiants ci-dessous ne sont pas complets.' : 'Réservé au propriétaire (super administrateur).'),
                ])->columnSpanFull(),
            Section::make('Identifiants CMI')
                ->schema([
                    TextInput::make('fields.merchantId')->label('Identifiant commerçant (clientid)')->maxLength(60)->regex('/^[A-Za-z0-9_-]{2,60}$/'),
                    TextInput::make('fields.gatewayUrl')->label('URL de la passerelle 3D Pay Hosting')->url()->regex('#^https://[^<>\s]+$#i')->placeholder('https://')->maxLength(300)
                        ->helperText('Fournie par le CMI (environnement de test ou de production).'),
                ])->columns($grid)->columnSpanFull(),
            Section::make('Identifiants confidentiels')
                ->description('Secret chiffré : jamais réaffiché. Saisissez une nouvelle valeur uniquement pour le remplacer.')->icon('heroicon-o-lock-closed')
                ->schema([
                    TextInput::make('fields.merchantSecret')->label('Nouvelle clé de boutique (store key)')->password()->autocomplete('new-password')->maxLength(500)
                        ->helperText('Écriture seule : vide conserve la clé existante.'),
                ])->columnSpanFull(),
        ])->columns(1);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\EditCmi::route('/'),
            'edit' => Pages\EditCmi::route('/{record}/edit'),
        ];
    }
}
