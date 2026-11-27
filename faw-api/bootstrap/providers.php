<?php

use App\Providers\AppServiceProvider;
use App\Providers\Filament\AdminPanelProvider;
use App\Providers\StorefrontCacheServiceProvider;

return [
    AppServiceProvider::class,
    AdminPanelProvider::class,
    StorefrontCacheServiceProvider::class,
];
