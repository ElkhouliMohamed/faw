<?php

namespace App\Filament\Resources\Contacts;

use App\Filament\Resources\InboxResource;

class ContactsResource extends InboxResource
{
    protected static ?string $navigationLabel = 'Formulaires de contact';

    protected static ?string $modelLabel = 'Formulaires de contact';

    protected static ?string $pluralModelLabel = 'Formulaires de contact';

    public static ?string $messageKind = 'contact';

    public static function getPages(): array
    {
        return ['index' => Pages\ManageContacts::route('/')];
    }
}
