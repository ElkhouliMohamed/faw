<?php

namespace App\Filament\Widgets;

use App\Models\Event;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

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
        return $table->defaultKeySort(false)->query(Event::query()->whereRaw("CASE WHEN typeof(at)='integer' THEN CAST(at AS INTEGER)/1000 ELSE CAST(strftime('%s',at) AS INTEGER) END >= ?", [now()->subDays(30)->timestamp])->selectRaw("MIN(id) as id,COALESCE(NULLIF(source,''),'direct') as trafficSource,COALESCE(medium,'') as trafficMedium,COALESCE(campaign,'') as trafficCampaign,SUM(CASE WHEN type='view' THEN 1 ELSE 0 END) as views,SUM(CASE WHEN type='quote_request' THEN 1 ELSE 0 END) as quotes,SUM(CASE WHEN type='order' THEN 1 ELSE 0 END) as orders")->groupByRaw("COALESCE(NULLIF(source,''),'direct'),COALESCE(medium,''),COALESCE(campaign,'')")->orderBy('trafficSource'))->columns([TextColumn::make('trafficSource')->label('Source / UTM'), TextColumn::make('trafficMedium')->label('Support UTM')->wrap(), TextColumn::make('trafficCampaign')->label('Campagne UTM')->wrap(), TextColumn::make('views')->label('Vues'), TextColumn::make('quotes')->label('Devis'), TextColumn::make('orders')->label('Commandes')])->paginated([10]);
    }
}
