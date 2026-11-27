<?php

namespace App\Filament\Resources\BlogTags\Pages;

use App\Filament\Resources\BlogTags\BlogTagsResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditBlogTag extends EditRecord
{
    protected static string $resource = BlogTagsResource::class;

    protected function getHeaderActions(): array
    {
        return [DeleteAction::make()];
    }
}
