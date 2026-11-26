<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Phase 7 (additive): category hierarchy + H1, product sales mode (inert while prices are hidden) + H1. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Category', function (Blueprint $t) {
            $t->unsignedBigInteger('parentId')->nullable()->index();
            $t->string('h1')->default('');
        });
        Schema::table('Product', function (Blueprint $t) {
            $t->string('salesMode', 16)->default('quote_only');
            $t->string('h1')->default('');
        });
    }

    public function down(): void
    {
        Schema::table('Product', fn (Blueprint $t) => $t->dropColumn(['salesMode', 'h1']));
        Schema::table('Category', function (Blueprint $t) {
            $t->dropIndex(['parentId']);
            $t->dropColumn(['parentId', 'h1']);
        });
    }
};
