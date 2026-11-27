<?php

namespace App\Filament\Resources\Homepages\Pages;

use App\Filament\Resources\Homepages\HomepagesResource;
use App\Services\HomeSections;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
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
            DeleteAction::make()->label('Revenir à l’accueil par défaut')
                ->modalDescription('La page d’accueil personnalisée est supprimée : le site affiche à nouveau l’accueil par défaut.'),
        ];
    }

    protected function getSavedNotificationTitle(): ?string
    {
        return 'Accueil enregistré : le site est mis à jour dans quelques secondes.';
    }
}
