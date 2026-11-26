<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Product', function (Blueprint $t) {
            $t->string('maintenanceGuide')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('Product', function (Blueprint $t) {
            $t->dropColumn('maintenanceGuide');
        });
    }
};
