<?php

namespace App\Filament\Widgets;

use App\Models\AuditEntry;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class RecentActivity extends TableWidget
{
    public static function canView(): bool
    {
        return auth()->user()?->canDo('view.audit') ?? false;
    }

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Activité récente du back-office';

    public function table(Table $table): Table
    {
        return $table->query(AuditEntry::query()->orderByDesc('id'))->columns([TextColumn::make('at')->label('Date')->dateTime('d/m/Y H:i'), TextColumn::make('actor')->label('Utilisateur'), TextColumn::make('action')->label('Action'), TextColumn::make('entity')->label('Module'), TextColumn::make('entityId')->label('Référence')])->paginated([5]);
    }
}
