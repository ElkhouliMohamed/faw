<?php

namespace App\Filament\Resources\Homepages\Pages;

use App\Filament\Resources\Homepages\HomepagesResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

/**
 * The home page is a single record. Once it exists, opening "Accueil" goes straight
 * to its edit page; until then this page shows an empty list with a create button.
 */
class ListHomepages extends ListRecords
{
    protected static string $resource = HomepagesResource::class;

    protected static ?string $title = 'Page d’accueil';

    public function mount(): void
    {
        parent::mount();

        $home = HomepagesResource::getEloquentQuery()->first();
        if ($home && HomepagesResource::canEdit($home)) {
            $this->redirect(HomepagesResource::getUrl('edit', ['record' => $home]));
        }
    }

    public function getSubheading(): ?string
    {
        return HomepagesResource::getEloquentQuery()->exists()
            ? null
            : 'La page d’accueil n’existe pas encore : créez-la pour personnaliser la bannière et les sections. En attendant, le site affiche l’accueil par défaut.';
    }

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()->label('Créer la page d’accueil')];
    }
}
