<?php

use App\Models\SystemConfig;
use App\Services\ConfigDefinitions;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        foreach (ConfigDefinitions::all() as $name => $def) {
            if (! SystemConfig::where('name', $name)->exists()) {
                SystemConfig::create(['name' => $name, 'value' => $def['defaults'] ?? []]);
            }
        }
    }

    public function down(): void
    {
        SystemConfig::where('name', 'shop')->delete();
    }
};
