<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['BlogCategory', 'BlogTag'] as $table) {
            Schema::create($table, function (Blueprint $t) {
                $t->id();
                $t->string('label');
                $t->string('slug')->unique();
                $t->boolean('active')->default(true);
                $t->timestamps();
            });
        }
        Schema::create('ContentPage', function (Blueprint $t) {
            $t->id();
            $t->string('kind');
            $t->string('slug');
            $t->unique(['kind', 'slug']);
            $t->string('title');
            $t->text('excerpt')->nullable();
            $t->text('bodyHtml')->nullable();
            $t->text('blocks')->default('[]');
            $t->string('image')->nullable();
            $t->string('seoTitle')->nullable();
            $t->text('seoDescription')->nullable();
            $t->boolean('published')->default(false);
            $t->dateTime('publishedAt')->nullable();
            $t->unsignedBigInteger('categoryId')->nullable();
            $t->text('tags')->default('[]');
            $t->string('featuredProductId')->nullable();
            $t->string('ctaLabel')->nullable();
            $t->string('ctaUrl')->nullable();
            $t->boolean('defaultSections')->default(true);
            $t->timestamps();
        });
        Schema::create('InboxMessage', function (Blueprint $t) {
            $t->id();
            $t->string('kind');
            $t->unsignedBigInteger('contactId')->nullable();
            $t->unsignedBigInteger('quoteId')->nullable()->unique();
            $t->string('name');
            $t->string('phone');
            $t->string('email')->nullable();
            $t->string('city')->nullable();
            $t->string('subject');
            $t->text('message');
            $t->string('productId')->nullable();
            $t->text('photos')->default('[]');
            $t->string('status')->default('nouveau');
            $t->string('priority')->default('normale');
            $t->unsignedBigInteger('assignedTo')->nullable();
            $t->text('notes')->nullable();
            $t->timestamps();
        });
    }

    public function down(): void
    {
        foreach (['InboxMessage', 'ContentPage', 'BlogTag', 'BlogCategory'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
