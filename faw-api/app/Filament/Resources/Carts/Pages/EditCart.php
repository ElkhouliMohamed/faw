<?php

namespace App\Filament\Resources\Carts\Pages;

use App\Filament\Resources\Carts\CartResource;
use Filament\Actions\ViewAction;
use Filament\Resources\Pages\EditRecord;

class EditCart extends EditRecord
{
    protected static string $resource = CartResource::class;

    protected function getHeaderActions(): array
    {
        return [CartResource::whatsappAction(), ViewAction::make()->label('Consulter')];
    }
}
