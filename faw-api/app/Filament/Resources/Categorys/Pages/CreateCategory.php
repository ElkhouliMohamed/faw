<?php

namespace App\Filament\Resources\Categorys\Pages;

use App\Filament\Resources\Categorys\CategoryResource;
use Filament\Resources\Pages\CreateRecord;

class CreateCategory extends CreateRecord
{
    protected static string $resource = CategoryResource::class;
}
