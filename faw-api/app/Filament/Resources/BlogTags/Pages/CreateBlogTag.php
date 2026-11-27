<?php

namespace App\Filament\Resources\BlogTags\Pages;

use App\Filament\Resources\BlogTags\BlogTagsResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBlogTag extends CreateRecord
{
    protected static string $resource = BlogTagsResource::class;
}
