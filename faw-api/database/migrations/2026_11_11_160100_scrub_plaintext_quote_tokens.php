<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Data step: remove plaintext link tokens. The legacy NOT NULL UNIQUE "token" column receives the sha256 hash
 * (never a usable link). Lookups use tokenHash only (Laravel API and the Next shop).
 * Irreversible by design: the plaintext values only survive in the pre-migration database backup.
 */
return new class extends Migration
{
    public function up(): void
    {
        $expires = now()->addDays((int) config('faw.quote_link_ttl_days', 90))->getTimestampMs();
        DB::table('Quote')->orderBy('id')->each(function ($q) use ($expires) {
            $isHash = (bool) preg_match('/^[0-9a-f]{64}$/', (string) $q->token);
            $hash = $q->tokenHash ?: ($isHash ? $q->token : hash('sha256', (string) $q->token));
            DB::table('Quote')->where('id', $q->id)->update([
                'tokenHash' => $hash,
                'token' => $hash,
                'tokenExpiresAt' => $q->tokenExpiresAt ?? $expires,
            ]);
        });
    }

    public function down(): void
    {
        // Plaintext tokens cannot be recomputed from their hash: restore the database backup taken before this migration.
    }
};
