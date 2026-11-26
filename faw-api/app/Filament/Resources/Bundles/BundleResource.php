<?php

namespace App\Filament\Resources\Bundles;

use App\Filament\Resources\OwnerResource;
use App\Models\Bundle;
use App\Models\Product;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class BundleResource extends OwnerResource
{
    protected static ?string $model = Bundle::class;

    protected static ?string $slug = 'bundles';

    protected static ?string $navigationLabel = 'Packs';

    protected static ?string $modelLabel = 'Packs';

    protected static ?string $pluralModelLabel = 'Packs';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('slug')->label('URL')->maxLength(255)->required()->regex('/^[a-z0-9-]+$/')->unique(ignoreRecord: true), TextInput::make('title')->label('Nom du pack')->maxLength(255)->required(), Textarea::make('description')->label('Description')->maxLength(12000)->columnSpanFull(), Repeater::make('items')->label('Composition')->schema([Select::make('id')->label('Produit')->options(Product::pluck('title', 'id')->all())->searchable()->required(), TextInput::make('qty')->label('Quantité')->integer()->minValue(1)->maxValue(99)->default(1)->dehydrateStateUsing(fn ($state) => (int) $state)->required()])->minItems(1)->maxItems(20)->columns(2)->columnSpanFull()->required(), TextInput::make('price')->label('Prix pack TTC (DH)')->maxLength(255)->integer()->minValue(0)->default(1)->required(), TextInput::make('image')->label('Photo (chemin local)')->maxLength(255)->regex('#^/(?:images|storage)/[a-zA-Z0-9/_.-]+$#'), TextInput::make('sortOrder')->label('Ordre')->maxLength(255)->integer()->minValue(0)->default(0)->required(), TextInput::make('seoTitle')->label('Titre SEO')->maxLength(255), Textarea::make('seoDescription')->label('Description SEO')->maxLength(12000)->columnSpanFull(), Toggle::make('active')->label('Actif')->default(false)])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('title')->label('Pack')->searchable(), TextColumn::make('price')->label('Prix')->suffix(' DH TTC'), IconColumn::make('active')->label('Actif')->boolean()])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageBundles::route('/')];
    }
}
