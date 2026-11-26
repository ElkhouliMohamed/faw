<?php

namespace App\Filament\Widgets;

use App\Models\Event;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Support\Facades\DB;

class TrafficSources extends TableWidget
{
    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Sources first-party — 30 jours';

    protected static bool $isDiscovered = false;

    public static function canView(): bool
    {
        return auth()->check();
    }

    public function table(Table $table): Table
    {
        // camelCase aliases are quoted by the grammar (PostgreSQL folds unquoted identifiers to lower case).
        $w = fn (string $id) => DB::getQueryGrammar()->wrap($id);
        $source = "COALESCE(NULLIF(source,''),'direct')";
        $query = Event::query()->where('at', '>=', now()->subDays(30)->getTimestampMs())
            ->selectRaw("MIN(id) as id,{$source} as {$w('trafficSource')},COALESCE(medium,'') as {$w('trafficMedium')},COALESCE(campaign,'') as {$w('trafficCampaign')},SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) as views,SUM(CASE WHEN type='quote_request' THEN 1 ELSE 0 END) as quotes,SUM(CASE WHEN type='order' THEN 1 ELSE 0 END) as orders")
            ->groupByRaw("{$source},COALESCE(medium,''),COALESCE(campaign,'')")->orderBy('trafficSource');

        return $table->defaultKeySort(false)->query($query)->columns([TextColumn::make('trafficSource')->label('Source / UTM'), TextColumn::make('trafficMedium')->label('Support UTM')->wrap(), TextColumn::make('trafficCampaign')->label('Campagne UTM')->wrap(), TextColumn::make('views')->label('Vues'), TextColumn::make('quotes')->label('Devis'), TextColumn::make('orders')->label('Commandes')])->paginated([10]);
    }
}
