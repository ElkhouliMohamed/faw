<?php

namespace App\Filament\Widgets;

use App\Models\AuditEntry;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

/** Last back-office actions (audit log), for users allowed to read it. */
class RecentActivity extends TableWidget
{
    protected static bool $isDiscovered = false;

    protected static ?int $sort = 8;

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Activité récente du back-office';

    public static function canView(): bool
    {
        return auth()->user()?->canDo('view.audit') ?? false;
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(AuditEntry::query()->orderByDesc('id'))
            ->columns([
                TextColumn::make('at')->label('Date')->dateTime('d/m/Y H:i', 'Africa/Casablanca'),
                TextColumn::make('actor')->label('Utilisateur'),
                TextColumn::make('action')->label('Action'),
                TextColumn::make('entity')->label('Module'),
                TextColumn::make('entityId')->label('Référence'),
            ])
            ->emptyStateHeading('Aucune action enregistrée')
            ->paginated([5]);
    }
}
