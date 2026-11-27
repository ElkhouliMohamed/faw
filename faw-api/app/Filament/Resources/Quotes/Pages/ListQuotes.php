<?php

namespace App\Filament\Resources\Quotes\Pages;

use App\Filament\Pages\QuotesKanban;
use App\Filament\Resources\Quotes\QuoteResource;
use Filament\Actions\Action;
use Filament\Resources\Pages\ListRecords;

class ListQuotes extends ListRecords
{
    protected static string $resource = QuoteResource::class;

    protected ?string $subheading = 'Demandes de devis reçues du site. Ouvrez un devis pour le valider, l’envoyer ou créer une nouvelle version.';

    protected function getHeaderActions(): array
    {
        return [
            Action::make('tableau')->label('Vue tableau')->icon('heroicon-o-view-columns')->color('gray')
                ->visible(fn () => QuotesKanban::canAccess())
                ->url(fn () => QuotesKanban::getUrl()),
        ];
    }
}
