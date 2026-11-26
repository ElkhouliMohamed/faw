<?php

use App\Support\QuoteSnapshot;
use Carbon\CarbonImmutable;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Additive: immutable quote versions + per-version email deliveries.
 * Existing validated/sent quotes get their version 1 rebuilt from the data already stored on Quote (no PDF regenerated).
 * The frozen columns are protected by SQLite triggers (no UPDATE of content, no DELETE).
 */
return new class extends Migration
{
    private const FROZEN = ['quote_id', 'version', 'number', 'lines', 'delivery', 'totals', 'total_ttc', 'currency', 'validity_days', 'valid_until', 'conditions', 'gen_input', 'pdf_file', 'pdf_sha256', 'issued_at', 'reason', 'created_by'];

    public function up(): void
    {
        if (! Schema::hasTable('quote_versions')) {
            Schema::create('quote_versions', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('quote_id')->index();
                $t->unsignedInteger('version');
                $t->string('number', 64);
                $t->json('lines');
                $t->json('delivery');
                $t->json('totals');
                $t->integer('total_ttc');
                $t->string('currency', 3)->default('MAD');
                $t->unsignedInteger('validity_days');
                $t->date('valid_until');
                $t->json('conditions');
                $t->json('gen_input');
                $t->string('pdf_file', 128);
                $t->string('pdf_sha256', 64)->nullable();
                $t->timestamp('issued_at');
                $t->string('reason', 500)->nullable();
                $t->unsignedBigInteger('created_by')->nullable();
                $t->string('email_status', 16)->nullable(); // queued | sent | failed
                $t->string('email_message_id', 191)->nullable();
                $t->string('email_error', 500)->nullable();
                $t->timestamp('email_sent_at')->nullable();
                $t->boolean('journaled')->default(false);
                $t->timestamps();
                $t->unique(['quote_id', 'version'], 'quote_versions_quote_version_unique');
                $t->unique('number', 'quote_versions_number_unique');
                $t->unique('pdf_file', 'quote_versions_pdf_file_unique');
            });
        }
        if (! Schema::hasTable('quote_version_emails')) {
            Schema::create('quote_version_emails', function (Blueprint $t) {
                $t->id();
                $t->unsignedBigInteger('quote_version_id')->index();
                $t->unsignedInteger('attempt');
                $t->string('idempotency_key', 191)->unique();
                $t->string('kind', 16); // auto | resend | legacy
                $t->string('status', 16); // queued | sent | failed
                $t->string('provider', 16)->nullable(); // resend | smtp
                $t->string('message_id', 191)->nullable();
                $t->string('error', 500)->nullable();
                $t->timestamp('queued_at')->nullable();
                $t->timestamp('sent_at')->nullable();
                $t->timestamp('failed_at')->nullable();
                $t->timestamps();
                $t->unique(['quote_version_id', 'attempt'], 'quote_version_emails_attempt_unique');
            });
        }
        if (! Schema::hasColumn('Quote', 'versionNumber')) {
            Schema::table('Quote', fn (Blueprint $t) => $t->string('versionNumber', 64)->nullable());
        }

        if (DB::getDriverName() === 'sqlite') {
            $cols = implode(', ', self::FROZEN);
            DB::statement('DROP TRIGGER IF EXISTS quote_versions_frozen');
            DB::statement("CREATE TRIGGER quote_versions_frozen BEFORE UPDATE OF {$cols} ON quote_versions BEGIN SELECT RAISE(ABORT, 'quote version is immutable'); END");
            DB::statement('DROP TRIGGER IF EXISTS quote_versions_no_delete');
            DB::statement("CREATE TRIGGER quote_versions_no_delete BEFORE DELETE ON quote_versions BEGIN SELECT RAISE(ABORT, 'quote version is immutable'); END");
        }

        $this->backfill();
    }

    private function backfill(): void
    {
        $out = rtrim((string) config('faw.output'), '/');
        DB::table('Quote')->whereIn('status', ['validé', 'envoyé'])->whereNotNull('number')->whereNotNull('pdfFile')->orderBy('id')->each(function ($q) use ($out) {
            if (DB::table('quote_versions')->where('quote_id', $q->id)->exists()) {
                return;
            }
            $lines = json_decode((string) $q->lines, true) ?: [];
            $gen = json_decode((string) $q->genInput, true) ?: [];
            $snap = QuoteSnapshot::build($lines, $gen['transport'] ?? [], (string) $q->transport, $q->kitLeaf !== null ? (float) $q->kitLeaf : null);
            $gen['lignes'] = array_map(fn ($l) => ['reference' => $l['id'], 'qte' => (int) $l['qty']] + (! empty($l['override']) ? ['prix_ttc_walfar' => $l['unit']] : []), $lines);
            $issued = $this->ts($q->validatedAt) ?? $this->ts($q->createdAt) ?? CarbonImmutable::now();
            $file = $out.'/'.basename((string) $q->pdfFile);
            $status = match ($q->emailStatus) {
                'envoyé' => 'sent', 'échec' => 'failed', default => null
            };
            $id = DB::table('quote_versions')->insertGetId([
                'quote_id' => $q->id, 'version' => 1, 'number' => (string) $q->number,
                'lines' => json_encode($snap['lines'], JSON_UNESCAPED_UNICODE), 'delivery' => json_encode($snap['delivery'], JSON_UNESCAPED_UNICODE),
                'totals' => json_encode($snap['totals']), 'total_ttc' => (int) $q->totalTtc, 'currency' => (string) config('faw.quote_currency', 'MAD'),
                'validity_days' => (int) config('faw.quote_validity_days', 14), 'valid_until' => QuoteSnapshot::validUntil($issued),
                'conditions' => json_encode(config('faw.quote_conditions', []), JSON_UNESCAPED_UNICODE), 'gen_input' => json_encode($gen, JSON_UNESCAPED_UNICODE),
                'pdf_file' => basename((string) $q->pdfFile), 'pdf_sha256' => is_file($file) ? hash_file('sha256', $file) : null,
                'issued_at' => $issued, 'reason' => 'Version initiale (reprise des données existantes)',
                'email_status' => $status, 'email_message_id' => $q->emailMessageId, 'email_error' => $q->emailError,
                'email_sent_at' => $this->ts($q->emailSentAt), 'journaled' => (bool) $q->journaled,
                'created_at' => now(), 'updated_at' => now(),
            ]);
            if ($status) {
                DB::table('quote_version_emails')->insert([
                    'quote_version_id' => $id, 'attempt' => 1, 'idempotency_key' => 'faw-devis-'.$q->id.'-v1-legacy', 'kind' => 'legacy', 'status' => $status,
                    'provider' => null, 'message_id' => $q->emailMessageId, 'error' => $q->emailError,
                    'sent_at' => $status === 'sent' ? $this->ts($q->emailSentAt) : null, 'failed_at' => $status === 'failed' ? $this->ts($q->emailLastAttemptAt) : null,
                    'created_at' => now(), 'updated_at' => now(),
                ]);
            }
            DB::table('Quote')->where('id', $q->id)->update(['versionNumber' => (string) $q->number]);
        });
    }

    private function ts(mixed $v): ?CarbonImmutable
    {
        if ($v === null || $v === '') {
            return null;
        }

        return is_numeric($v) ? CarbonImmutable::createFromTimestampMs((int) $v, 'UTC') : CarbonImmutable::parse($v, 'UTC');
    }

    public function down(): void
    {
        DB::statement('DROP TRIGGER IF EXISTS quote_versions_frozen');
        DB::statement('DROP TRIGGER IF EXISTS quote_versions_no_delete');
        Schema::dropIfExists('quote_version_emails');
        Schema::dropIfExists('quote_versions');
        if (Schema::hasColumn('Quote', 'versionNumber')) {
            Schema::table('Quote', fn (Blueprint $t) => $t->dropColumn('versionNumber'));
        }
    }
};
