<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database (idempotent shop defaults only).
     * Back-office accounts are created with php artisan faw:owner, never with a known password here.
     */
    public function run(): void
    {
        $this->call(ShopDefaultsSeeder::class);
        $this->call(CatalogSeeder::class);
        $this->call(HomeTemplateSeeder::class);
    }
}
