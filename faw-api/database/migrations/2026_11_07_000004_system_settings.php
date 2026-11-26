<?php

use App\Models\SystemConfig;
use App\Services\ConfigDefinitions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('SystemConfig', function (Blueprint $t) {
            $t->id();
            $t->string('name')->unique();
            $t->text('value');
            $t->timestamps();
        });
        foreach (ConfigDefinitions::all() as $name => $def) {
            SystemConfig::create(['name' => $name, 'value' => $def['defaults'] ?? []]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('SystemConfig');
    }
};
