<?php

namespace App\Filament\Resources\BlogTags\Pages;

use App\Filament\Resources\BlogTags\BlogTagsResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListBlogTags extends ListRecords
{
    protected static string $resource = BlogTagsResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
