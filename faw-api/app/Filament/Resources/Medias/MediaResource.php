<?php

namespace App\Filament\Resources\Medias;

use App\Filament\Resources\OwnerResource;
use App\Models\Media;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class MediaResource extends OwnerResource
{
    protected static ?string $slug = 'medias';

    protected static ?string $model = Media::class;

    protected static ?string $navigationLabel = 'Médiathèque';

    protected static ?string $modelLabel = 'Image';

    protected static ?string $pluralModelLabel = 'Médiathèque';

    protected static string|\UnitEnum|null $navigationGroup = 'Contenu';

    public static function form(Schema $s): Schema
    {
        return $s->components([FileUpload::make('file')->label('Image')->disk('public')->directory('media')->visibility('public')->acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])->maxSize(4096)->required()->helperText('JPEG/PNG/WebP/GIF/AVIF, 4 Mo maximum, nom aléatoire. SVG et scripts refusés.'), TextInput::make('alt')->label('Texte alternatif')->maxLength(300), TextInput::make('url')->label('Chemin à utiliser dans les pages')->disabled()->dehydrated(false)]);
    }

    public static function table(Table $t): Table
    {
        return $t->columns([ImageColumn::make('preview')->label('Image')->getStateUsing(fn ($record) => $record->url ? url($record->url) : null), TextColumn::make('url')->label('Chemin')->searchable()->wrap()->copyable(), TextColumn::make('alt')->label('Texte alternatif')->wrap(), TextColumn::make('size')->label('Octets')])->recordActions([EditAction::make(), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageMedias::route('/')];
    }
}
