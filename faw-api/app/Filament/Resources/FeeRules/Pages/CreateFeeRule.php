<?php

namespace App\Filament\Resources\FeeRules\Pages;

use App\Filament\Resources\FeeRules\FeeRuleResource;
use Filament\Resources\Pages\CreateRecord;

class CreateFeeRule extends CreateRecord
{
    protected static string $resource = FeeRuleResource::class;

    protected function getRedirectUrl(): string
    {
        return static::getResource()::getUrl('index');
    }
}
