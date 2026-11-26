<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Additive: customer orders created from an accepted quote version, with status history and a yearly sequence. */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('order_sequences')) {
            Schema::create('order_sequences', function (Blueprint $t) {
                $t->unsignedSmallInteger('year')->primary();
                $t->unsignedInteger('last')->default(0);
            });
        }
        if (! Schema::hasTable('customer_orders')) {
            Schema::create('customer_orders', function (Blueprint $t) {
                $t->id();
                $t->string('reference', 32)->unique();
                $t->unsignedBigInteger('quote_id')->unique(); // one order per quote (idempotent acceptance)
                $t->unsignedBigInteger('quote_version_id');
                $t->unsignedBigInteger('quote_decision_id')->unique();
                $t->string('version_number', 64);
                $t->string('client_name');
                $t->string('phone', 64)->nullable();
                $t->string('email')->nullable();
                $t->string('city')->nullable();
                $t->json('lines');
                $t->json('totals');
                $t->integer('total_ttc');
                $t->string('currency', 3)->default('MAD');
                $t->unsignedTinyInteger('tax_rate');
                $t->json('delivery');
                $t->string('fulfilment', 16); // retrait | livraison
                $t->text('delivery_address')->nullable();
                $t->string('delivery_note', 500)->nullable();
                $t->string('status', 32)->index();
                $t->timestamp('status_changed_at')->nullable();
                $t->text('internal_note')->nullable();
                $t->timestamps();
            });
        }
        if (! Schema::hasTable('order_status_history')) {
            Schema::create('order_status_history', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('customer_order_id')->index();
                $t->string('from_status', 32)->nullable();
                $t->string('to_status', 32);
                $t->string('note', 500)->nullable();
                $t->string('source', 16); // system | admin | payment
                $t->unsignedBigInteger('user_id')->nullable();
                $t->timestamp('created_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('order_status_history');
        Schema::dropIfExists('customer_orders');
        Schema::dropIfExists('order_sequences');
    }
};
