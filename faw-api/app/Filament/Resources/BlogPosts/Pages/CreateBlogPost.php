<?php

namespace App\Filament\Resources\BlogPosts\Pages;

use App\Filament\Resources\BlogPosts\BlogPostsResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBlogPost extends CreateRecord
{
    protected static string $resource = BlogPostsResource::class;

    /** Every CMS resource shares the ContentPage table: the kind decides where the page is published. */
    protected function mutateFormDataBeforeCreate(array $data): array
    {
        $data['kind'] = BlogPostsResource::$contentKind;

        return $data;
    }
}
