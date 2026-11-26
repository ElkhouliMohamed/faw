<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Additive: optional TOTP (app) authentication, opt-in per user from the profile page. Values are encrypted by the model casts.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'app_authentication_secret')) {
                $table->text('app_authentication_secret')->nullable();
            }
            if (! Schema::hasColumn('users', 'app_authentication_recovery_codes')) {
                $table->text('app_authentication_recovery_codes')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['app_authentication_secret', 'app_authentication_recovery_codes']);
        });
    }
};
