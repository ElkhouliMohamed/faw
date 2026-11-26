<?php

namespace App\Filament\Resources\AuditLogs;

use App\Filament\Resources\OwnerResource;
use App\Models\AuditEntry;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Model;

class AuditLogResource extends OwnerResource
{
    protected static ?string $model = AuditEntry::class;

    protected static ?string $navigationLabel = 'Journal d’activité';

    protected static ?string $modelLabel = 'Événement';

    protected static ?string $pluralModelLabel = 'Journal d’activité';

    protected static ?string $slug = 'audit-log';

    protected static string|\UnitEnum|null $navigationGroup = 'Système';

    protected static ?int $navigationSort = 90;

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(Model $record): bool
    {
        return false;
    }

    public static function canDelete(Model $record): bool
    {
        return false;
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('at')->label('Quand')->dateTime('d/m/Y H:i:s')->sortable(),
                TextColumn::make('actor')->label('Qui')->searchable(),
                TextColumn::make('action')->label('Action')->badge(),
                TextColumn::make('entity')->label('Modèle')->searchable(),
                TextColumn::make('entityId')->label('Identifiant')->toggleable(),
                TextColumn::make('summary')->label('Résumé')->wrap()->limit(80)->toggleable(),
                TextColumn::make('changes')->label('Modifications')->wrap()->limit(200)->toggleable(),
            ])
            ->defaultSort('id', 'desc')
            ->recordActions([])
            ->toolbarActions([])
            ->paginated([25, 50]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ManageAuditLogs::route('/')];
    }
}
