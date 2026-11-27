<?php

namespace App\Filament\Resources\ContentPages\Pages;

use App\Filament\Resources\ContentPages\ContentPagesResource;
use Filament\Resources\Pages\CreateRecord;

class CreateContentPage extends CreateRecord
{
    protected static string $resource = ContentPagesResource::class;

    /** Every CMS resource shares the ContentPage table: the kind decides where the page is published. */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['kind'] = ContentPagesResource::$contentKind;

        return $data;
    }
}
