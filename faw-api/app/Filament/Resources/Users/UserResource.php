<?php

namespace App\Filament\Resources\Users;

use App\Filament\Resources\OwnerResource;
use App\Models\User;
use App\Support\Role;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class UserResource extends OwnerResource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationLabel = 'Utilisateurs';

    protected static ?string $modelLabel = 'Utilisateurs';

    protected static ?string $pluralModelLabel = 'Utilisateurs';

    protected static string|\UnitEnum|null $navigationGroup = 'Paramètres';

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->label('Nom')->maxLength(255)->required(),
            TextInput::make('email')->label('Email')->maxLength(255)->required()->email()->unique(ignoreRecord: true),
            Select::make('role')->label('Rôle')->options(Role::options())->default(Role::Viewer->value)->required()->formatStateUsing(fn ($state) => Role::resolve($state)?->value ?? $state)->dehydrateStateUsing(fn ($state) => Role::resolve($state)?->value ?? $state),
            Toggle::make('is_active')->label('Compte actif')->default(true)->helperText('Un compte désactivé ne peut plus se connecter.'),
            TextInput::make('password')->label('Mot de passe')->password()->afterStateHydrated(fn ($component) => $component->state(''))->minLength(12)->required(fn (string $operation) => $operation === 'create')->dehydrateStateUsing(fn ($state) => Hash::make($state))->dehydrated(fn ($state) => filled($state)),
        ])->columns(2);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->label('Nom'),
            TextColumn::make('email')->label('Email')->searchable(),
            TextColumn::make('role')->label('Rôle')->formatStateUsing(fn ($state) => Role::resolve($state)?->label() ?? $state),
            IconColumn::make('is_active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')->recordActions([EditAction::make()->label('Ouvrir')]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageUsers::route('/')];
    }
}
