<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });
        DB::table('users')->where('role', 'admin')->update(['role' => 'super_admin']);
        DB::table('users')->where('email', 'admin@faw.ma')->update(['role' => 'super_admin', 'is_active' => true]);
        DB::table('users')->where('email', 'agent@faw.ma')->update(['role' => 'viewer', 'is_active' => true]);

        Schema::table('AuditLog', function (Blueprint $table) {
            if (! Schema::hasColumn('AuditLog', 'changes')) {
                $table->text('changes')->nullable();
            }
        });
    }

    public function down(): void
    {
        DB::table('users')->where('role', 'super_admin')->update(['role' => 'admin']);
        if (Schema::hasColumn('AuditLog', 'changes')) {
            Schema::table('AuditLog', function (Blueprint $table) {
                $table->dropColumn('changes');
            });
        }
        if (Schema::hasColumn('users', 'is_active')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('is_active');
            });
        }
    }
};
