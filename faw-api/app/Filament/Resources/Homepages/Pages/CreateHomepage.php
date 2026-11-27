<?php

namespace App\Filament\Resources\Homepages\Pages;

use App\Filament\Resources\Homepages\HomepagesResource;
use Filament\Resources\Pages\CreateRecord;

class CreateHomepage extends CreateRecord
{
    protected static string $resource = HomepagesResource::class;

    protected static ?string $title = 'Créer la page d’accueil';

    /** Every CMS resource shares the ContentPage table: the kind decides where the page is published. */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['kind'] = HomepagesResource::$contentKind;

        return $data;
    }
}
