<?php

namespace App\Filament\Widgets;

use App\Services\AnalyticsQueries;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

class ProductSales extends TableWidget
{
    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Par produit — 30 jours';

    protected static bool $isDiscovered = false;

    public static function canView(): bool
    {
        return auth()->check();
    }

    public function table(Table $table): Table
    {
        return $table->defaultKeySort(false)->query(AnalyticsQueries::products())->columns([TextColumn::make('productId')->label('Référence'), TextColumn::make('title')->label('Produit')->wrap(), TextColumn::make('quantity')->label('Unités demandées'), TextColumn::make('sales')->label('Ventes confirmées, hors transport')->suffix(' DH TTC')])->paginated([10, 30]);
    }
}
