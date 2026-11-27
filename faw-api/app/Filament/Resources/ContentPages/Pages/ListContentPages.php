<?php

namespace App\Filament\Resources\ContentPages\Pages;

use App\Filament\Resources\ContentPages\ContentPagesResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListContentPages extends ListRecords
{
    protected static string $resource = ContentPagesResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
