<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Storefront menus edited in Filament (header and footer columns). One row per location; empty = built-in default menu. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('SiteMenu', function (Blueprint $t) {
            $t->id();
            $t->string('location')->unique();
            $t->string('title')->default('');
            $t->text('items')->default('[]');
            $t->boolean('active')->default(true);
            $t->bigInteger('updatedAt')->nullable(); // epoch ms, like the other shop tables (ShopTimestamp cast)
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('SiteMenu');
    }
};
