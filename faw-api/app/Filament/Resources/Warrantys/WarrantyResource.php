<?php

namespace App\Filament\Resources\Warrantys;

use App\Filament\Resources\OwnerResource;
use App\Models\Warranty;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;

class WarrantyResource extends OwnerResource
{
    protected static ?string $model = Warranty::class;

    protected static ?string $slug = 'warrantys';

    protected static ?string $navigationLabel = 'Assigner Garanties';

    protected static ?string $modelLabel = 'garantie';

    protected static ?string $pluralModelLabel = 'Assigner Garanties';

    protected static ?string $recordTitleAttribute = 'name';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Garantie')
                ->description('Conditions de garantie à rattacher à une catégorie ou à un produit. N’indiquer que des conditions confirmées par écrit.')
                ->schema([
                    TextInput::make('name')->label('Intitulé')->maxLength(255)->required()
                        ->helperText('Nom interne et public, ex. « Garantie fabricant 2 ans ».'),
                    Toggle::make('active')->label('Actif')->default(false)
                        ->helperText('Seules les garanties actives peuvent être assignées.'),
                    Textarea::make('text')->label('Conditions confirmées (facultatif)')->maxLength(12000)->rows(6)->columnSpanFull()
                        ->helperText('Laisser vide si non confirmé. Aucune garantie par défaut, notamment pour le kit.'),
                ])
                ->columns(2)
                ->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('name')->label('Intitulé')->searchable()->sortable(),
                TextColumn::make('text')->label('Conditions')->limit(100)->wrap(),
                IconColumn::make('active')->label('Actif')->boolean(),
            ])
            ->filters([TernaryFilter::make('active')->label('Actif')])
            ->defaultSort('id', 'desc')
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListWarrantys::route('/'),
            'create' => Pages\CreateWarranty::route('/create'),
            'edit' => Pages\EditWarranty::route('/{record}/edit'),
        ];
    }
}
