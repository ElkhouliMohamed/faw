<?php

namespace App\Services;

use App\Models\CustomerOrder;
use App\Models\InboxMessage;
use App\Models\Quote;
use App\Models\QuoteDecision;
use App\Models\QuoteOtp;
use App\Models\QuoteVersion;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Customer actions on the private quote link (no account): read, accept with an e-mail code, refuse, ask for a change.
 * Every method returns ['ok' => bool, 'code' => machine code, ...]; the shop maps codes to FR/AR texts.
 */
class QuotePortal
{
    public function __construct(private TransactionalMail $mail) {}

    public function current(Quote $q): ?QuoteVersion
    {
        return in_array($q->status, ['validé', 'envoyé']) && $q->number ? $q->currentVersion() : null;
    }

    public function acceptedDecision(Quote $q): ?QuoteDecision
    {
        return QuoteDecision::where('accepted_quote_id', $q->id)->first();
    }

    public function isExpired(QuoteVersion $v): bool
    {
        return substr((string) $v->valid_until, 0, 10) < now('Africa/Casablanca')->format('Y-m-d');
    }

    /** Why the current version cannot be accepted right now (null = acceptable). */
    public function acceptBlock(Quote $q, ?int $versionId = null): ?string
    {
        $v = $this->current($q);
        if (! $v) {
            return 'not_ready';
        }
        if ($this->acceptedDecision($q)) {
            return 'already_accepted';
        }
        if ($versionId !== null && $versionId !== $v->id) {
            return 'not_current';
        }
        if ($this->isExpired($v)) {
            return 'expired';
        }
        if (QuoteDecision::where('quote_version_id', $v->id)->where('decision', 'refused')->exists()) {
            return 'refused';
        }

        return null;
    }

    public function state(Quote $q): array
    {
        $v = $this->current($q);
        $accepted = $this->acceptedDecision($q);
        $block = $this->acceptBlock($q);
        $otpBlock = $block ?? $this->otpBlock($q);

        return [
            'quote' => [
                'id' => $q->id, 'status' => $q->status, 'ready' => (bool) $v, 'clientName' => $q->clientName,
                'number' => $q->versionNumber ?: $q->number, 'customerDecision' => $q->customerDecision,
                'linkExpiresAt' => $q->tokenExpiresAt?->toIso8601String(),
            ],
            'version' => $v ? [
                'id' => $v->id, 'version' => $v->version, 'number' => $v->number, 'issuedAt' => $v->issued_at?->toIso8601String(),
                'validUntil' => substr((string) $v->valid_until, 0, 10), 'expired' => $this->isExpired($v), 'currency' => $v->currency,
                'lines' => array_map(fn ($l) => ['reference' => $l['reference'], 'name' => $l['name'], 'qty' => $l['qty'], 'unitTtc' => $l['unit_ttc'], 'totalTtc' => $l['total_ttc']], $v->lines),
                'totals' => $v->totals, 'delivery' => $v->delivery, 'conditions' => $v->conditions,
            ] : null,
            'actions' => [
                'canAccept' => $v !== null && $otpBlock === null,
                'acceptBlock' => $otpBlock,
                'canRefuse' => $v !== null && $block === null,
                'canRequestChange' => $v !== null && ! $accepted,
                'emailMasked' => $this->mask($q->email),
            ],
            'accepted' => $accepted ? ['versionNumber' => $accepted->version_number, 'at' => $accepted->created_at?->toIso8601String()] : null,
            'order' => app(OrderService::class)->portalState($q),
            'history' => QuoteDecision::where('quote_id', $q->id)->orderBy('id')->get()->map(fn ($d) => ['decision' => $d->decision, 'versionNumber' => $d->version_number, 'at' => $d->created_at?->toIso8601String()])->all(),
        ];
    }

    protected function otpBlock(Quote $q): ?string
    {
        if (! filter_var($q->email, FILTER_VALIDATE_EMAIL)) {
            return 'no_email';
        }
        if (! EmailSettings::ready()) {
            return 'mail_unavailable';
        }

        return null;
    }

    public function requestOtp(Quote $q, int $versionId, ?string $ip): array
    {
        if ($code = $this->acceptBlock($q, $versionId) ?? $this->otpBlock($q)) {
            return ['ok' => false, 'code' => $code];
        }
        $key = 'portal-otp:'.$q->id;
        if (RateLimiter::tooManyAttempts($key, 3)) {
            return ['ok' => false, 'code' => 'rate_limited', 'retryAfter' => RateLimiter::availableIn($key)];
        }
        RateLimiter::hit($key, 900);
        $v = $this->current($q);
        QuoteOtp::where('quote_id', $q->id)->whereNull('consumed_at')->whereNull('locked_at')->update(['locked_at' => now()]);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $ttl = (int) config('faw.otp_ttl_minutes', 10);
        $otp = QuoteOtp::create(['quote_id' => $q->id, 'quote_version_id' => $v->id, 'code_hash' => QuoteOtp::hashCode($q->id, $code), 'expires_at' => now()->addMinutes($ttl), 'ip' => $ip]);
        $text = "Bonjour,\n\nVotre code de confirmation pour accepter le devis FAW n° {$v->number} : {$code}\nIl est valable {$ttl} minutes. Ne le communiquez à personne.\n\n"
            ."مرحباً،\nرمز التأكيد لقبول عرض السعر رقم {$v->number} : {$code}\nصالح لمدة {$ttl} دقائق. لا تشاركه مع أي شخص.\n\nFAW Aluminium";
        $sent = $this->mail->send((string) $q->email, 'Code de confirmation FAW : devis n° '.$v->number, $text, 'faw-otp-'.$otp->id);
        if (! $sent['ok']) {
            $otp->update(['locked_at' => now()]);

            return ['ok' => false, 'code' => 'mail_failed'];
        }

        return ['ok' => true, 'code' => 'otp_sent', 'emailMasked' => $this->mask($q->email), 'expiresIn' => $ttl * 60];
    }

    public function accept(Quote $q, int $versionId, string $code, bool $confirm, ?string $ip, ?string $ua): array
    {
        if ($block = $this->acceptBlock($q, $versionId)) {
            return ['ok' => false, 'code' => $block];
        }
        if (! $confirm) {
            return ['ok' => false, 'code' => 'confirm_required'];
        }
        $key = 'portal-accept:'.$q->id;
        if (RateLimiter::tooManyAttempts($key, 10)) {
            return ['ok' => false, 'code' => 'rate_limited', 'retryAfter' => RateLimiter::availableIn($key)];
        }
        RateLimiter::hit($key, 900);
        $otp = QuoteOtp::where('quote_id', $q->id)->where('quote_version_id', $versionId)->whereNull('consumed_at')->whereNull('locked_at')->orderByDesc('id')->first();
        if (! $otp) {
            return ['ok' => false, 'code' => 'otp_missing'];
        }
        if ($otp->expires_at->isPast()) {
            $otp->update(['locked_at' => now()]);

            return ['ok' => false, 'code' => 'otp_expired'];
        }
        $max = (int) config('faw.otp_max_attempts', 5);
        if (! preg_match('/^\d{6}$/', $code) || ! hash_equals($otp->code_hash, QuoteOtp::hashCode($q->id, $code))) {
            $attempts = $otp->attempts + 1;
            $otp->update(['attempts' => $attempts] + ($attempts >= $max ? ['locked_at' => now()] : []));

            return ['ok' => false, 'code' => $attempts >= $max ? 'otp_locked' : 'otp_invalid', 'remaining' => max(0, $max - $attempts)];
        }

        try {
            $decision = DB::transaction(function () use ($q, $otp, $versionId, $ip, $ua) {
                if (DB::table('quote_otps')->where('id', $otp->id)->whereNull('consumed_at')->whereNull('locked_at')->update(['consumed_at' => now(), 'updated_at' => now()]) !== 1) {
                    return null;
                }
                $fresh = $q->fresh();
                if ($this->acceptBlock($fresh, $versionId)) {
                    return null;
                }
                $v = QuoteVersion::findOrFail($versionId);
                $d = QuoteDecision::create(['quote_id' => $q->id, 'quote_version_id' => $v->id, 'version_number' => $v->number, 'decision' => 'accepted', 'ip' => $ip, 'user_agent' => $ua ? mb_substr($ua, 0, 500) : null, 'otp_id' => $otp->id, 'accepted_quote_id' => $q->id]);
                $fresh->forceFill(['customerDecision' => 'accepté', 'customerDecisionAt' => now()])->save();
                $this->afterAcceptance($fresh, $v, $d);

                return $d;
            });
        } catch (UniqueConstraintViolationException) {
            $decision = null;
        }
        if (! $decision) {
            return ['ok' => false, 'code' => $this->acceptBlock($q->fresh(), $versionId) ?? 'otp_missing'];
        }
        RateLimiter::clear($key);
        $order = CustomerOrder::where('quote_id', $q->id)->first();
        $this->notifyTeam($q->fresh(), 'accepté par le client', 'Version acceptée : '.$decision->version_number.'.'.($order ? "\nCommande créée : ".$order->reference.' (en attente de paiement).' : ''), 'accept-'.$decision->id);

        return ['ok' => true, 'code' => 'accepted'];
    }

    /** The order is created inside the acceptance transaction (all or nothing, idempotent per quote). */
    protected function afterAcceptance(Quote $q, QuoteVersion $v, QuoteDecision $d): void
    {
        app(OrderService::class)->createFromAcceptance($q, $v, $d);
    }

    public function refuse(Quote $q, int $versionId, ?string $reason, ?string $ip, ?string $ua): array
    {
        if ($block = $this->acceptBlock($q, $versionId)) {
            return ['ok' => false, 'code' => $block];
        }
        if ($limited = $this->limit('portal-refuse:'.$q->id, 5, 3600)) {
            return $limited;
        }
        $v = QuoteVersion::findOrFail($versionId);
        $reason = $reason !== null ? mb_substr(trim($reason), 0, 1000) : null;
        $d = QuoteDecision::create(['quote_id' => $q->id, 'quote_version_id' => $v->id, 'version_number' => $v->number, 'decision' => 'refused', 'message' => $reason ?: null, 'ip' => $ip, 'user_agent' => $ua ? mb_substr($ua, 0, 500) : null]);
        $q->forceFill(['customerDecision' => 'refusé', 'customerDecisionAt' => now()])->save();
        $this->notifyTeam($q, 'refusé par le client', 'Version : '.$v->number.'.'.($reason ? "\nMotif : ".$reason : ''), 'refuse-'.$d->id);

        return ['ok' => true, 'code' => 'refused_saved'];
    }

    public function requestModification(Quote $q, string $message, ?string $ip, ?string $ua): array
    {
        $v = $this->current($q);
        if (! $v) {
            return ['ok' => false, 'code' => 'not_ready'];
        }
        if ($this->acceptedDecision($q)) {
            return ['ok' => false, 'code' => 'already_accepted'];
        }
        $message = trim($message);
        if (mb_strlen($message) < 5 || mb_strlen($message) > 2000) {
            return ['ok' => false, 'code' => 'message_invalid'];
        }
        if ($limited = $this->limit('portal-change:'.$q->id, 5, 3600)) {
            return $limited;
        }
        $d = QuoteDecision::create(['quote_id' => $q->id, 'quote_version_id' => $v->id, 'version_number' => $v->number, 'decision' => 'modification_requested', 'message' => $message, 'ip' => $ip, 'user_agent' => $ua ? mb_substr($ua, 0, 500) : null]);
        $q->forceFill(['customerDecision' => 'modification demandée', 'customerDecisionAt' => now()])->save();
        // One inbox thread per quote (unique quoteId): reopen it with the customer's request on top.
        $inbox = InboxMessage::firstOrNew(['quoteId' => $q->id]);
        $stamp = now('Africa/Casablanca')->format('d/m/Y H:i');
        $inbox->fill(['kind' => 'quote', 'contactId' => $q->contactId, 'name' => $q->clientName, 'phone' => $q->phone, 'email' => $q->email, 'city' => $q->city, 'subject' => 'Modification demandée : devis '.$v->number, 'status' => 'nouveau',
            'message' => '['.$stamp.'] Modification demandée (version '.$v->number.') : '.$message.($inbox->message ? "\n\n".$inbox->message : '')])->save();
        $this->notifyTeam($q, 'modification demandée par le client', 'Version : '.$v->number."\nMessage : ".$message, 'change-'.$d->id);

        return ['ok' => true, 'code' => 'modification_saved'];
    }

    protected function limit(string $key, int $max, int $decay): ?array
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            return ['ok' => false, 'code' => 'rate_limited', 'retryAfter' => RateLimiter::availableIn($key)];
        }
        RateLimiter::hit($key, $decay);

        return null;
    }

    protected function notifyTeam(Quote $q, string $event, string $details, string $key): void
    {
        $to = TransactionalMail::teamAddress();
        if (! $to) {
            return;
        }
        $number = $q->versionNumber ?: $q->number;
        $text = "Devis {$number} (demande n° {$q->id}) : {$event}.\nClient : {$q->clientName} — {$q->city}.\n{$details}\n\nÀ traiter dans le back-office FAW (Devis).";
        $this->mail->send($to, 'FAW — devis '.$number.' '.$event, $text, 'faw-team-'.$q->id.'-'.$key);
    }

    public function mask(?string $email): ?string
    {
        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return null;
        }
        [$user, $domain] = explode('@', $email, 2);

        return mb_substr($user, 0, 1).str_repeat('•', max(2, min(6, mb_strlen($user) - 1))).'@'.$domain;
    }
}
