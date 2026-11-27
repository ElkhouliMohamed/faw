<?php

namespace App\Filament\Resources\SavRequests;

use App\Filament\Resources\InboxResource;

class SavRequestsResource extends InboxResource
{
    protected static ?string $navigationLabel = 'Demandes SAV';

    protected static ?string $modelLabel = 'demande SAV';

    protected static ?string $pluralModelLabel = 'Demandes SAV';

    public static ?string $messageKind = 'sav';

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListSavRequests::route('/'),
            'create' => Pages\CreateSavRequest::route('/create'),
            'view' => Pages\ViewSavRequest::route('/{record}'),
            'edit' => Pages\EditSavRequest::route('/{record}/edit'),
        ];
    }
}
