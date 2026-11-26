<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Additive: hashed quote link tokens with expiry and revocation.
 * Existing links keep working: their token is hashed into tokenHash and given an expiry of now + TTL.
 * The plaintext column is left untouched here (see 2026_11_11_160100 for the scrub step).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('Quote', function (Blueprint $table) {
            if (! Schema::hasColumn('Quote', 'tokenHash')) {
                $table->string('tokenHash', 64)->nullable();
            }
            if (! Schema::hasColumn('Quote', 'tokenExpiresAt')) {
                $table->dateTime('tokenExpiresAt')->nullable();
            }
            if (! Schema::hasColumn('Quote', 'tokenRevokedAt')) {
                $table->dateTime('tokenRevokedAt')->nullable();
            }
        });
        if (! $this->hasTokenHashIndex()) {
            Schema::table('Quote', fn (Blueprint $t) => $t->unique('tokenHash', 'Quote_tokenHash_key'));
        }

        $expires = now()->addDays((int) config('faw.quote_link_ttl_days', 90))->getTimestampMs();
        DB::table('Quote')->whereNull('tokenHash')->orderBy('id')->each(function ($q) use ($expires) {
            DB::table('Quote')->where('id', $q->id)->update([
                'tokenHash' => hash('sha256', (string) $q->token),
                'tokenExpiresAt' => $q->tokenExpiresAt ?? $expires,
            ]);
        });
    }

    private function hasTokenHashIndex(): bool
    {
        return collect(Schema::getIndexes('Quote'))->contains(fn ($i) => strcasecmp($i['name'], 'Quote_tokenHash_key') === 0 || $i['columns'] === ['tokenHash']);
    }

    public function down(): void
    {
        if ($this->hasTokenHashIndex()) {
            Schema::table('Quote', fn (Blueprint $t) => $t->dropUnique('Quote_tokenHash_key'));
        }
        foreach (['tokenRevokedAt', 'tokenExpiresAt', 'tokenHash'] as $col) {
            if (Schema::hasColumn('Quote', $col)) {
                Schema::table('Quote', fn (Blueprint $t) => $t->dropColumn($col));
            }
        }
    }
};
