<?php

namespace App\Filament\Resources\Medias\Pages;

use App\Filament\Resources\Medias\MediaResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditMedia extends EditRecord
{
    protected static string $resource = MediaResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
