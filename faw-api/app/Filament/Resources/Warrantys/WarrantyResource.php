<?php

namespace App\Filament\Resources\Warrantys;

use App\Filament\Resources\OwnerResource;
use App\Models\Warranty;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class WarrantyResource extends OwnerResource
{
    protected static ?string $model = Warranty::class;

    protected static ?string $slug = 'warrantys';

    protected static ?string $navigationLabel = 'Assigner Garanties';

    protected static ?string $modelLabel = 'Assigner Garanties';

    protected static ?string $pluralModelLabel = 'Assigner Garanties';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('name')->label('Intitulé')->maxLength(255)->required(), Textarea::make('text')->label('Conditions confirmées (facultatif)')->maxLength(12000)->columnSpanFull()->helperText('Laisser vide si non confirmé. Aucune garantie par défaut, notamment pour le kit.'), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('name')->label('Intitulé')->searchable(), TextColumn::make('text')->label('Conditions')->limit(100)->wrap()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageWarrantys::route('/')];
    }
}
