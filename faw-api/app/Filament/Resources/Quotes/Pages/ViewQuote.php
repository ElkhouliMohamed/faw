<?php

namespace App\Filament\Resources\Quotes\Pages;

use App\Filament\Resources\Quotes\QuoteResource;
use Filament\Actions\ActionGroup;
use Filament\Resources\Pages\ViewRecord;

class ViewQuote extends ViewRecord
{
    protected static string $resource = QuoteResource::class;

    public function getTitle(): string
    {
        $q = $this->getRecord();

        return 'Devis '.($q->versionNumber ?: $q->number ?: '#'.$q->getKey()).' — '.$q->clientName;
    }

    /** Same workflow actions as the list rows (QuoteService for validation, e-mails and versions). */
    protected function getHeaderActions(): array
    {
        return [
            QuoteResource::validateAction(),
            QuoteResource::newVersionAction(),
            QuoteResource::pdfAction(),
            QuoteResource::resendAction(),
            QuoteResource::refuseAction(),
            ActionGroup::make([QuoteResource::revokeLinkAction(), QuoteResource::regenerateLinkAction()])->label('Lien client')->icon('heroicon-o-link')->button()->color('gray'),
        ];
    }
}
