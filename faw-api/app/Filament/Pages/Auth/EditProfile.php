<?php

namespace App\Filament\Pages\Auth;

use Filament\Auth\Pages\EditProfile as BaseEditProfile;
use Filament\Facades\Filament;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Component;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * « Mon profil » : chaque utilisateur change SON mot de passe (mot de passe actuel exigé, 12 caractères minimum,
 * confirmation) et peut activer la double authentification par application (facultative, voir AdminPanelProvider).
 * L'e-mail et le rôle restent gérés par un super administrateur.
 */
class EditProfile extends BaseEditProfile
{
    public const MIN_PASSWORD = 12;

    public function form(Schema $schema): Schema
    {
        return $schema->components([
            $this->getNameFormComponent(),
            TextInput::make('email')->label('E-mail')->disabled()->dehydrated(false),
            $this->getPasswordFormComponent(),
            $this->getPasswordConfirmationFormComponent(),
            $this->getCurrentPasswordFormComponent(),
        ]);
    }

    protected function getPasswordFormComponent(): Component
    {
        return parent::getPasswordFormComponent()
            ->label('Nouveau mot de passe')
            ->rule(Password::min(self::MIN_PASSWORD))
            ->helperText(self::MIN_PASSWORD.' caractères minimum. Les autres sessions ouvertes seront déconnectées.');
    }

    protected function getCurrentPasswordFormComponent(): Component
    {
        // Exigé dès qu'un nouveau mot de passe est saisi (l'e-mail n'est plus modifiable ici).
        return parent::getCurrentPasswordFormComponent()->label('Mot de passe actuel');
    }

    protected function afterSave(): void
    {
        $user = $this->getUser();
        if (! $user->wasChanged('password')) {
            return;
        }
        // Les autres sessions sont invalidées par AuthenticateSession (empreinte du mot de passe changée) ;
        // on renouvelle aussi le jeton « se souvenir de moi » et l'identifiant de la session courante.
        $user->forceFill(['remember_token' => Str::random(60)])->saveQuietly();
        $session = request()->hasSession() ? request()->session() : session()->driver();
        $session->regenerate();
        $session->put('password_hash_'.Filament::getAuthGuard(), $user->getAuthPassword());
    }
}
