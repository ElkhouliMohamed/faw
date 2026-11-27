<?php

namespace App\Filament\Resources\BlogCategories\Pages;

use App\Filament\Resources\BlogCategories\BlogCategoriesResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditBlogCategory extends EditRecord
{
    protected static string $resource = BlogCategoriesResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
