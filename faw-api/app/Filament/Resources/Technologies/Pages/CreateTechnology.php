<?php

namespace App\Filament\Resources\Technologies\Pages;

use App\Filament\Resources\Technologies\TechnologiesResource;
use Filament\Resources\Pages\CreateRecord;

class CreateTechnology extends CreateRecord
{
    protected static string $resource = TechnologiesResource::class;

    /** Every CMS resource shares the ContentPage table: the kind decides where the page is published. */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['kind'] = TechnologiesResource::$contentKind;

        return $data;
    }
}
