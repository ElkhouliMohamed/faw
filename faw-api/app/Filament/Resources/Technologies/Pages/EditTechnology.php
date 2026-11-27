<?php

namespace App\Filament\Resources\Technologies\Pages;

use App\Filament\Resources\Technologies\TechnologiesResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditTechnology extends EditRecord
{
    protected static string $resource = TechnologiesResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
