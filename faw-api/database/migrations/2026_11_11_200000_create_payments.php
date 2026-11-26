<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Phase 6 — payment foundation (additive). Amounts are whole MAD, typed by FAW; no fees, no interest. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $t) {
            $t->id();
            $t->foreignId('customer_order_id')->index();
            $t->unsignedInteger('position');
            $t->string('label', 120);
            $t->unsignedBigInteger('amount');
            $t->string('currency', 3)->default('MAD');
            $t->string('provider', 32)->default('bank_transfer');
            $t->string('reference', 64)->unique();
            $t->string('status', 32)->index();
            $t->string('proof_path')->nullable();
            $t->string('proof_mime', 64)->nullable();
            $t->unsignedInteger('proof_size')->nullable();
            $t->timestamp('proof_uploaded_at')->nullable();
            $t->string('provider_transaction_id', 128)->nullable()->unique();
            $t->timestamp('confirmed_at')->nullable();
            $t->foreignId('confirmed_by')->nullable();
            $t->timestamps();
        });

        Schema::create('payment_transactions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('payment_id')->index();
            $t->foreignId('customer_order_id')->index();
            $t->string('type', 32);
            $t->string('from_status', 32)->nullable();
            $t->string('to_status', 32)->nullable();
            $t->unsignedBigInteger('amount')->nullable();
            $t->string('note', 1000)->nullable();
            $t->string('source', 16);
            $t->foreignId('user_id')->nullable();
            $t->string('ip', 45)->nullable();
            $t->json('meta')->nullable();
            $t->timestamp('created_at')->nullable();
        });

        Schema::create('payment_webhook_events', function (Blueprint $t) {
            $t->id();
            $t->string('provider', 32);
            $t->string('event_id', 128);
            $t->string('payload_hash', 64);
            $t->string('result', 32);
            $t->timestamp('created_at')->nullable();
            $t->unique(['provider', 'event_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
        Schema::dropIfExists('payment_transactions');
        Schema::dropIfExists('payments');
    }
};
