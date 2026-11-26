<?php

namespace App\Filament\Resources\Badges;

use App\Filament\Resources\OwnerResource;
use App\Models\Badge;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class BadgeResource extends OwnerResource
{
    protected static ?string $model = Badge::class;

    protected static ?string $slug = 'badges';

    protected static ?string $navigationLabel = 'Badges';

    protected static ?string $modelLabel = 'Badges';

    protected static ?string $pluralModelLabel = 'Badges';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('label')->label('Libellé')->maxLength(255)->required(), Select::make('tone')->label('Style')->options(['neutral' => 'Neutre', 'copper' => 'Cuivre', 'green' => 'Vert doux'])->default('neutral')->required(), TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required(), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('label')->label('Badge')->searchable(), TextColumn::make('tone')->label('Style')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageBadges::route('/')];
    }
}
