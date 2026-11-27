<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('LandingPage', function (Blueprint $table) {
            $table->string('title_ar')->nullable();
            $table->string('seoTitle_ar')->nullable();
            $table->text('seoDescription_ar')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('LandingPage', function (Blueprint $table) {
            $table->dropColumn(['title_ar', 'seoTitle_ar', 'seoDescription_ar']);
        });
    }
};
