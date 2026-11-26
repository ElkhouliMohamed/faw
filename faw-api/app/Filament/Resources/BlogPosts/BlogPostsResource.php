<?php

namespace App\Filament\Resources\BlogPosts;

use App\Filament\Resources\ContentResource;

class BlogPostsResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Articles du blog';

    protected static ?string $modelLabel = 'Articles du blog';

    protected static ?string $pluralModelLabel = 'Articles du blog';

    protected static ?string $slug = 'blogposts';

    public static string $contentKind = 'blog';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageBlogPosts::route('/')];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('blog' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
