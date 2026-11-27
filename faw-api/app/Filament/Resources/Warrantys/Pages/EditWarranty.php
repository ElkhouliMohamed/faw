<?php

namespace App\Filament\Resources\Warrantys\Pages;

use App\Filament\Resources\Warrantys\WarrantyResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditWarranty extends EditRecord
{
    protected static string $resource = WarrantyResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
