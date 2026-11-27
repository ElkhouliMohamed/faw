<?php

namespace App\Filament\Resources\Products\Pages;

use App\Filament\Resources\Products\ProductResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditProduct extends EditRecord
{
    protected static string $resource = ProductResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        return ProductResource::photo($data);
    }

    /** Reload the saved paths (photo, PDFs) and clear the upload fields so a later save cannot reuse stale values. */
    protected function afterSave(): void
    {
        $this->fillForm();
    }
}
