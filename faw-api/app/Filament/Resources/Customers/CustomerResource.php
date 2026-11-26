<?php

namespace App\Filament\Resources\Customers;

use App\Filament\Resources\OwnerResource;
use App\Models\Customer;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CustomerResource extends OwnerResource
{
    protected static ?string $model = Customer::class;

    protected static ?string $navigationLabel = 'Clients';

    protected static ?string $modelLabel = 'Clients';

    protected static ?string $pluralModelLabel = 'Clients';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([TextInput::make('name')->label('Nom')->maxLength(255)->required(), TextInput::make('phone')->label('Téléphone')->maxLength(255)->required()->maxLength(30)->unique(ignoreRecord: true), TextInput::make('email')->label('Email')->maxLength(255)->email(), TextInput::make('city')->label('Ville')->maxLength(255), Select::make('type')->label('Type')->options(['particulier' => 'Particulier', 'entreprise' => 'Entreprise'])->default('particulier')->required(), TextInput::make('company')->label('Entreprise')->maxLength(255), TextInput::make('ice')->label('ICE')->maxLength(255)->regex('/^\d{15}$/')->nullable(), TextInput::make('tags')->label('Étiquettes')->maxLength(255), TextInput::make('source')->label('Source')->maxLength(255)->default('site')])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('name')->label('Nom')->searchable(), TextColumn::make('phone')->label('Téléphone')->searchable(), TextColumn::make('email')->label('Email'), TextColumn::make('city')->label('Ville'), TextColumn::make('company')->label('Entreprise')])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageCustomers::route('/')];
    }
}
