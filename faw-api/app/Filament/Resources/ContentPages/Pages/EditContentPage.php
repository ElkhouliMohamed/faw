<?php

namespace App\Filament\Resources\ContentPages\Pages;

use App\Filament\Resources\ContentPages\ContentPagesResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditContentPage extends EditRecord
{
    protected static string $resource = ContentPagesResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
