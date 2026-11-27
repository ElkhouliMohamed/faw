<?php

namespace App\Filament\Resources\Technologies\Pages;

use App\Filament\Resources\Technologies\TechnologiesResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListTechnologies extends ListRecords
{
    protected static string $resource = TechnologiesResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
