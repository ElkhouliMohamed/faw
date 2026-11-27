<?php

namespace App\Filament\Resources\Menus\Pages;

use App\Filament\Resources\Menus\MenuResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListMenus extends ListRecords
{
    protected static string $resource = MenuResource::class;

    protected static ?string $title = 'Menus du site';

    public function getSubheading(): ?string
    {
        return 'En-tête et pied de page de la boutique. Un emplacement sans menu actif affiche les liens par défaut.';
    }

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()->label('Nouveau menu')];
    }
}
