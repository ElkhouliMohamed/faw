<?php

namespace App\Filament\Resources\Customers;

use App\Filament\Resources\OwnerResource;
use App\Models\Customer;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class CustomerResource extends OwnerResource
{
    protected static ?string $model = Customer::class;

    protected static ?string $navigationLabel = 'Clients';

    protected static ?string $modelLabel = 'client';

    protected static ?string $pluralModelLabel = 'Clients';

    protected static ?string $recordTitleAttribute = 'name';

    protected static string|\UnitEnum|null $navigationGroup = 'Ventes';

    public static function form(Schema $schema): Schema
    {
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Coordonnées')
                ->description('Identité et moyens de contact du client.')
                ->schema([
                    TextInput::make('name')->label('Nom')->maxLength(255)->required(),
                    TextInput::make('phone')->label('Téléphone')->maxLength(255)->required()->maxLength(30)->unique(ignoreRecord: true)
                        ->placeholder('06 12 34 56 78')->helperText('Identifiant unique du client : une seule fiche par numéro.'),
                    TextInput::make('email')->label('Email')->maxLength(255)->email(),
                    TextInput::make('city')->label('Ville')->maxLength(255),
                ])->columns($grid),
            Section::make('Entreprise')
                ->description('À renseigner pour les clients professionnels (B2B).')
                ->schema([
                    Select::make('type')->label('Type')->options(['particulier' => 'Particulier', 'entreprise' => 'Entreprise'])->default('particulier')->required(),
                    TextInput::make('company')->label('Entreprise')->maxLength(255),
                    TextInput::make('ice')->label('ICE')->maxLength(255)->regex('/^\d{15}$/')->nullable()
                        ->helperText('Identifiant commun de l’entreprise : 15 chiffres.'),
                ])->columns($grid),
            Section::make('Suivi commercial')
                ->schema([
                    TextInput::make('tags')->label('Étiquettes')->maxLength(255)
                        ->helperText('Mots-clés séparés par des virgules (ex. : architecte, chantier).'),
                    TextInput::make('source')->label('Source')->maxLength(255)->default('site')
                        ->helperText('Origine du contact : site, salon, recommandation…'),
                ])->columns($grid),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->label('Nom')->searchable()->sortable()->weight('bold'),
            TextColumn::make('phone')->label('Téléphone')->searchable(),
            TextColumn::make('email')->label('Email')->searchable()->toggleable(),
            TextColumn::make('city')->label('Ville')->sortable(),
            TextColumn::make('company')->label('Entreprise')->searchable()->placeholder('—'),
            TextColumn::make('type')->label('Type')->badge()->toggleable(isToggledHiddenByDefault: true),
        ])->defaultSort('id', 'desc')
            ->filters([
                SelectFilter::make('type')->label('Type')->options(['particulier' => 'Particulier', 'entreprise' => 'Entreprise']),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir'), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListCustomers::route('/'),
            'create' => Pages\CreateCustomer::route('/create'),
            'edit' => Pages\EditCustomer::route('/{record}/edit'),
        ];
    }
}
