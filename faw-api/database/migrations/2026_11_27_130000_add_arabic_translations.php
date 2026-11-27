<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Product', function (Blueprint $t) {
            $t->text('title_ar')->nullable();
            $t->text('description_ar')->nullable();
            $t->text('shortDescription_ar')->nullable();
            $t->text('seoTitle_ar')->nullable();
            $t->text('seoDescription_ar')->nullable();
            $t->text('h1_ar')->nullable();
        });

        Schema::table('Category', function (Blueprint $t) {
            $t->text('label_ar')->nullable();
            $t->text('short_ar')->nullable();
            $t->text('description_ar')->nullable();
            $t->text('seoTitle_ar')->nullable();
            $t->text('seoDescription_ar')->nullable();
            $t->text('h1_ar')->nullable();
        });

        Schema::table('ContentPage', function (Blueprint $t) {
            $t->text('title_ar')->nullable();
            $t->text('excerpt_ar')->nullable();
            $t->text('bodyHtml_ar')->nullable();
            $t->text('seoTitle_ar')->nullable();
            $t->text('seoDescription_ar')->nullable();
            $t->text('ctaLabel_ar')->nullable();
        });

        Schema::table('SiteMenu', function (Blueprint $t) {
            $t->text('title_ar')->nullable();
        });

        Schema::table('BlogCategory', function (Blueprint $t) {
            $t->string('label_ar')->nullable();
        });

        Schema::table('BlogTag', function (Blueprint $t) {
            $t->string('label_ar')->nullable();
        });

        Schema::table('ShippingCity', function (Blueprint $t) {
            $t->text('name_ar')->nullable();
            $t->text('delayText_ar')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('Product', function (Blueprint $t) {
            $t->dropColumn(['title_ar', 'description_ar', 'shortDescription_ar', 'seoTitle_ar', 'seoDescription_ar', 'h1_ar']);
        });

        Schema::table('Category', function (Blueprint $t) {
            $t->dropColumn(['label_ar', 'short_ar', 'description_ar', 'seoTitle_ar', 'seoDescription_ar', 'h1_ar']);
        });

        Schema::table('ContentPage', function (Blueprint $t) {
            $t->dropColumn(['title_ar', 'excerpt_ar', 'bodyHtml_ar', 'seoTitle_ar', 'seoDescription_ar', 'ctaLabel_ar']);
        });

        Schema::table('SiteMenu', function (Blueprint $t) {
            $t->dropColumn(['title_ar']);
        });

        Schema::table('BlogCategory', function (Blueprint $t) {
            $t->dropColumn(['label_ar']);
        });

        Schema::table('BlogTag', function (Blueprint $t) {
            $t->dropColumn(['label_ar']);
        });

        Schema::table('ShippingCity', function (Blueprint $t) {
            $t->dropColumn(['name_ar', 'delayText_ar']);
        });
    }
};
