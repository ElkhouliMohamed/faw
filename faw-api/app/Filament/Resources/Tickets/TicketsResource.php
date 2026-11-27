<?php

namespace App\Filament\Resources\Tickets;

use App\Filament\Resources\InboxResource;

class TicketsResource extends InboxResource
{
    protected static ?string $navigationLabel = 'Tickets support';

    protected static ?string $modelLabel = 'ticket support';

    protected static ?string $pluralModelLabel = 'Tickets support';

    public static ?string $messageKind = 'ticket';

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListTickets::route('/'),
            'create' => Pages\CreateTicket::route('/create'),
            'view' => Pages\ViewTicket::route('/{record}'),
            'edit' => Pages\EditTicket::route('/{record}/edit'),
        ];
    }
}
