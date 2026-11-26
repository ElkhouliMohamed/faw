<?php

namespace App\Filament\Resources\FeeRules\Pages;

use App\Filament\Resources\FeeRules\FeeRuleResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ManageRecords;

class ManageFeeRules extends ManageRecords
{
    protected static string $resource = FeeRuleResource::class;

    protected function getHeaderActions(): array
    {
        return [CreateAction::make()];
    }
}
