<?php

namespace App\Filament\Resources\BlogPosts;

use App\Filament\Resources\ContentPages\ContentLayout;
use App\Filament\Resources\ContentResource;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class BlogPostsResource extends ContentResource
{
    protected static ?string $navigationLabel = 'Articles du blog';

    protected static ?string $modelLabel = 'article';

    protected static ?string $pluralModelLabel = 'Articles du blog';

    protected static ?string $recordTitleAttribute = 'title';

    protected static ?string $slug = 'blogposts';

    public static string $contentKind = 'blog';

    public static function form(Schema $schema): Schema
    {
        return ContentLayout::arrange($schema, parent::form(Schema::make())->getComponents(), static::$contentKind);
    }

    public static function table(Table $table): Table
    {
        return ContentLayout::table(parent::table($table));
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListBlogPosts::route('/'),
            'create' => Pages\CreateBlogPost::route('/create'),
            'edit' => Pages\EditBlogPost::route('/{record}/edit'),
        ];
    }

    public static function canCreate(): bool
    {
        return parent::canCreate() && ('blog' !== 'home' || ! static::getEloquentQuery()->exists());
    }
}
