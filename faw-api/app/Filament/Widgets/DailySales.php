<?php

namespace App\Filament\Widgets;

use App\Services\AnalyticsQueries;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class DailySales extends TableWidget
{
    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Demandes et ventes par jour — 30 jours';

    protected static bool $isDiscovered = false;

    public static function canView(): bool
    {
        return auth()->check();
    }

    public function table(Table $table): Table
    {
        return $table->defaultKeySort(false)->query(AnalyticsQueries::daily())->columns([TextColumn::make('period')->label('Jour (Casablanca)')->formatStateUsing(fn ($state) => AnalyticsQueries::dayLabel($state)), TextColumn::make('requests')->label('Demandes'), TextColumn::make('quotes')->label('Devis'), TextColumn::make('sales')->label('Ventes confirmées TTC')->suffix(' DH TTC')])->paginated([10, 30]);
    }
}
