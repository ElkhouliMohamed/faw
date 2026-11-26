<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Additive: customer portal on the private quote link (e-mail OTP, decisions audit trail). */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('quote_otps')) {
            Schema::create('quote_otps', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('quote_id')->index();
                $t->unsignedBigInteger('quote_version_id');
                $t->string('code_hash', 64);
                $t->timestamp('expires_at');
                $t->unsignedTinyInteger('attempts')->default(0);
                $t->timestamp('consumed_at')->nullable();
                $t->timestamp('locked_at')->nullable();
                $t->string('ip', 64)->nullable();
                $t->timestamps();
            });
        }
        if (! Schema::hasTable('quote_decisions')) {
            Schema::create('quote_decisions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('quote_id')->index();
                $t->unsignedBigInteger('quote_version_id');
                $t->string('version_number', 64);
                $t->string('decision', 32); // accepted | refused | modification_requested
                $t->text('message')->nullable();
                $t->string('ip', 64)->nullable();
                $t->string('user_agent', 500)->nullable();
                $t->unsignedBigInteger('otp_id')->nullable();
                // One acceptance per quote: set only for accepted decisions (NULLs are not unique-checked).
                $t->unsignedBigInteger('accepted_quote_id')->nullable()->unique();
                $t->timestamps();
            });
        }
        Schema::table('Quote', function (Blueprint $t) {
            if (! Schema::hasColumn('Quote', 'customerDecision')) {
                $t->string('customerDecision', 32)->nullable();
            }
            if (! Schema::hasColumn('Quote', 'customerDecisionAt')) {
                $t->bigInteger('customerDecisionAt')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_decisions');
        Schema::dropIfExists('quote_otps');
        foreach (['customerDecisionAt', 'customerDecision'] as $c) {
            if (Schema::hasColumn('Quote', $c)) {
                Schema::table('Quote', fn (Blueprint $t) => $t->dropColumn($c));
            }
        }
    }
};
