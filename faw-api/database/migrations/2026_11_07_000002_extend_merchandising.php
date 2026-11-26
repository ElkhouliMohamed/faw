<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Quote', fn (Blueprint $t) => $t->text('sourceItems')->nullable());
        Schema::table('Redirect', fn (Blueprint $t) => $t->unsignedInteger('hits')->default(0));
    }

    public function down(): void
    {
        Schema::table('Quote', fn (Blueprint $t) => $t->dropColumn('sourceItems'));
        Schema::table('Redirect', fn (Blueprint $t) => $t->dropColumn('hits'));
    }
};
