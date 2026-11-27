<?php

namespace App\Filament\Resources\Contacts;

use App\Filament\Resources\InboxResource;

class ContactsResource extends InboxResource
{
    protected static ?string $navigationLabel = 'Formulaires de contact';

    protected static ?string $modelLabel = 'formulaire de contact';

    protected static ?string $pluralModelLabel = 'Formulaires de contact';

    public static ?string $messageKind = 'contact';

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListContacts::route('/'),
            'create' => Pages\CreateContact::route('/create'),
            'view' => Pages\ViewContact::route('/{record}'),
            'edit' => Pages\EditContact::route('/{record}/edit'),
        ];
    }
}
