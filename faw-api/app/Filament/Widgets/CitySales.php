<?php

namespace App\Filament\Widgets;

use App\Services\AnalyticsQueries;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class CitySales extends TableWidget
{
    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Par ville — 30 jours';

    protected static bool $isDiscovered = false;

    public static function canView(): bool
    {
        return auth()->check();
    }

    public function table(Table $table): Table
    {
        return $table->defaultKeySort(false)->query(AnalyticsQueries::cities())->columns([TextColumn::make('city')->label('Ville')->wrap(), TextColumn::make('requests')->label('Demandes'), TextColumn::make('sales')->label('Ventes confirmées TTC')->suffix(' DH TTC')])->paginated([10, 30]);
    }
}
