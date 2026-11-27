<?php

namespace App\Filament\Resources\Homepages\Pages;

use App\Filament\Resources\Homepages\HomepagesResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditHomepage extends EditRecord
{
    protected static string $resource = HomepagesResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
