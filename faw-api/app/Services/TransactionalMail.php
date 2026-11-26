<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;

/**
 * Plain transactional e-mails (portal codes, team notifications) through the transport configured in the back office
 * (Resend or SMTP). Never contains links. Returns the provider message id, never throws.
 */
class TransactionalMail
{
    /** @return array{ok: bool, id: ?string, error: ?string} */
    public function send(string $to, string $subject, string $text, string $idempotencyKey): array
    {
        if (! EmailSettings::ready()) {
            return ['ok' => false, 'id' => null, 'error' => 'Email non configuré.'];
        }
        if (! filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'id' => null, 'error' => 'Adresse e-mail invalide.'];
        }
        if (preg_match('/https?:\/\/|www\.|href\s*=|devis\/suivi|devis\/pdf/i', $subject.$text)) {
            return ['ok' => false, 'id' => null, 'error' => 'Le message ne doit pas contenir de lien.'];
        }
        $email = EmailSettings::resolve();
        $html = '<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#432A13;line-height:1.55;font-size:15px;">'
            .nl2br(htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')).'</body></html>';
        try {
            if ($email['transport'] === 'smtp') {
                config(['mail.mailers.faw_smtp' => ['transport' => 'smtp', 'scheme' => $email['scheme'] === 'ssl' ? 'smtps' : 'smtp', 'host' => $email['host'], 'port' => $email['port'], 'username' => $email['username'], 'password' => $email['password'], 'timeout' => 30, 'auto_tls' => true]]);
                Mail::purge('faw_smtp');
                $sent = Mail::mailer('faw_smtp')->html($html, function ($m) use ($email, $to, $subject, $text) {
                    $m->from($email['from'], 'FAW Aluminium')->to($to)->subject($subject)->text($text);
                    if (! empty($email['replyTo'])) {
                        $m->replyTo($email['replyTo']);
                    }
                });

                return ['ok' => true, 'id' => $sent?->getMessageId(), 'error' => null];
            }
            $payload = ['from' => $email['from'], 'to' => [$to], 'subject' => $subject, 'text' => $text, 'html' => $html];
            if (! empty($email['replyTo'])) {
                $payload['reply_to'] = $email['replyTo'];
            }
            $r = Http::timeout(20)->withToken($email['key'])->withHeaders(['Idempotency-Key' => $idempotencyKey])->post('https://api.resend.com/emails', $payload);
            if (! $r->successful()) {
                return ['ok' => false, 'id' => null, 'error' => 'Transport email indisponible (HTTP '.$r->status().').'];
            }

            return ['ok' => true, 'id' => $r->json('id'), 'error' => null];
        } catch (\Throwable) {
            return ['ok' => false, 'id' => null, 'error' => 'Transport email indisponible.'];
        }
    }

    /** Internal FAW address for notifications: FAW_TEAM_EMAIL, else the configured reply-to. */
    public static function teamAddress(): ?string
    {
        $candidate = config('faw.team_email') ?: EmailSettings::resolve()['replyTo'];
        if (is_string($candidate) && preg_match('/<([^>]+)>/', $candidate, $m)) {
            $candidate = $m[1];
        }

        return filter_var($candidate, FILTER_VALIDATE_EMAIL) ? $candidate : null;
    }
}
