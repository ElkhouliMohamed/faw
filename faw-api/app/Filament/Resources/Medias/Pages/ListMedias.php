<?php

namespace App\Filament\Resources\Medias\Pages;

use App\Filament\Resources\Medias\MediaResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListMedias extends ListRecords
{
    protected static string $resource = MediaResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
