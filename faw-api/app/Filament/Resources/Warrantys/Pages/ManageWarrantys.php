<?php

namespace App\Filament\Resources\Warrantys\Pages;

use App\Filament\Resources\Warrantys\WarrantyResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageWarrantys extends ManageRecords
{
    protected static string $resource = WarrantyResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
