<?php

namespace App\Filament\Resources\BlogTags\Pages;

use App\Filament\Resources\BlogTags\BlogTagsResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageBlogTags extends ManageRecords
{
    protected static string $resource = BlogTagsResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
