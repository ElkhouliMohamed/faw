<?php

namespace App\Filament\Resources\Homepages\Pages;

use App\Filament\Resources\Homepages\HomepagesResource;
use App\Models\ContentPage;
use App\Services\HomeSections;
use App\Services\HomeTemplate;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Validation\ValidationException;

class EditHomepage extends EditRecord
{
    protected static string $resource = HomepagesResource::class;

    protected static ?string $title = 'Page d’accueil';

    /** A home page saved before the section builder stores flat blocks: show them in the builder shape. */
    protected function mutateFormDataBeforeFill(array $data): array
    {
        try {
            $data['blocks'] = HomeSections::normalize($data['blocks'] ?? []);
        } catch (ValidationException) {
            $data['blocks'] = [];
        }

        return $data;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('preview')->label('Voir sur le site')->icon('heroicon-o-arrow-top-right-on-square')->color('gray')->url('/')->openUrlInNewTab(),
            Action::make('resetTemplate')->label('Réinitialiser avec le modèle')->icon('heroicon-o-arrow-uturn-left')->color('warning')
                ->visible(fn (): bool => HomepagesResource::canEdit($this->getRecord()))
                ->requiresConfirmation()
                ->modalHeading('Réinitialiser la page d’accueil ?')
                ->modalDescription('Toutes les sections sont remplacées par le modèle d’origine (textes français et arabes, ordre, icônes). Les photos téléversées restent dans la médiathèque mais ne sont plus utilisées. Cette action est enregistrée immédiatement.')
                ->modalSubmitActionLabel('Oui, réinitialiser')
                ->action(function (): void {
                    abort_unless(HomepagesResource::canEdit($this->getRecord()), 403);
                    /** @var ContentPage $record */
                    $record = $this->getRecord();
                    $record->blocks = HomeTemplate::sections();
                    $record->save();
                    $this->fillForm();
                    Notification::make()->title('Accueil réinitialisé avec le modèle')->success()->send();
                }),
            // Rarement utile : rangé en lien discret pour ne pas être confondu avec « Réinitialiser avec le modèle ».
            DeleteAction::make()->label('Supprimer cette page')->link()->color('danger')
                ->modalHeading('Supprimer la page d’accueil personnalisée ?')
                ->modalDescription('La page d’accueil personnalisée est supprimée : le site affiche à nouveau le modèle d’accueil par défaut.'),
        ];
    }

    protected function getSavedNotificationTitle(): ?string
    {
        return 'Accueil enregistré : le site est mis à jour dans quelques secondes.';
    }
}
