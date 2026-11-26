<?php

namespace App\Filament\Pages;

use Filament\Pages\Page;

class Catalogue extends Page
{
    public static function canAccess(): bool
    {
        return (auth()->user()?->canDo('view.catalogue_pdf') ?? false) || (auth()->user()?->canDo('view.catalogue') ?? false);
    }

    protected static ?string $navigationLabel = 'Catalogue PDF';

    protected static ?string $title = 'Catalogue PDF FAW';

    protected static string|\UnitEnum|null $navigationGroup = 'Catalogue';

    protected string $view = 'filament.pages.catalogue';
}
