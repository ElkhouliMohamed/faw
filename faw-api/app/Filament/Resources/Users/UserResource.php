<?php

namespace App\Filament\Resources\Users;

use App\Filament\Resources\OwnerResource;
use App\Models\User;
use App\Support\Role;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Hash;

class UserResource extends OwnerResource
{
    protected static ?string $model = User::class;

    protected static ?string $navigationLabel = 'Utilisateurs';

    protected static ?string $modelLabel = 'utilisateur';

    protected static ?string $pluralModelLabel = 'Utilisateurs';

    protected static ?string $recordTitleAttribute = 'name';

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
        $grid = ['default' => 1, 'lg' => 2];

        return $schema->components([
            Section::make('Identité')
                ->description('Nom affiché dans le back-office et adresse de connexion.')
                ->schema([
                    TextInput::make('name')->label('Nom')->maxLength(255)->required(),
                    TextInput::make('email')->label('Email')->maxLength(255)->required()->email()->unique(ignoreRecord: true)
                        ->helperText('Sert d’identifiant de connexion.'),
                ])->columns($grid),
            Section::make('Accès')
                ->description('Le rôle détermine les menus visibles et les actions autorisées.')
                ->schema([
                    Select::make('role')->label('Rôle')->options(Role::options())->default(Role::Viewer->value)->required()->formatStateUsing(fn ($state) => Role::resolve($state)?->value ?? $state)->dehydrateStateUsing(fn ($state) => Role::resolve($state)?->value ?? $state),
                    Toggle::make('is_active')->label('Compte actif')->default(true)->inline(false)->helperText('Un compte désactivé ne peut plus se connecter.'),
                ])->columns($grid),
            Section::make('Mot de passe')
                ->description(fn (string $operation) => $operation === 'create' ? 'Choisissez un mot de passe d’au moins 12 caractères.' : 'Laissez vide pour conserver le mot de passe actuel.')
                ->schema([
                    TextInput::make('password')->label('Mot de passe')->password()->revealable()->autocomplete('new-password')->afterStateHydrated(fn ($component) => $component->state(''))->minLength(12)->required(fn (string $operation) => $operation === 'create')->dehydrateStateUsing(fn ($state) => Hash::make($state))->dehydrated(fn ($state) => filled($state))
                        ->helperText('12 caractères minimum.'),
                ])->columns($grid),
        ])->columns(1);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('name')->label('Nom')->searchable()->sortable()->weight('bold'),
            TextColumn::make('email')->label('Email')->searchable(),
            TextColumn::make('role')->label('Rôle')->badge()->formatStateUsing(fn ($state) => Role::resolve($state)?->label() ?? $state),
            IconColumn::make('is_active')->label('Actif')->boolean(),
        ])->defaultSort('id', 'desc')
            ->filters([
                SelectFilter::make('role')->label('Rôle')->options(Role::options())
                    // legacy accounts may still store 'admin', which resolves to super_admin
                    ->query(fn (Builder $query, array $data) => filled($data['value'] ?? null)
                        ? $query->whereIn('role', $data['value'] === Role::SuperAdmin->value ? [Role::SuperAdmin->value, 'admin'] : [$data['value']])
                        : $query),
                TernaryFilter::make('is_active')->label('Compte actif'),
            ])
            ->recordActions([EditAction::make()->label('Ouvrir')]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListUsers::route('/'),
            'create' => Pages\CreateUser::route('/create'),
            'edit' => Pages\EditUser::route('/{record}/edit'),
        ];
    }
}
