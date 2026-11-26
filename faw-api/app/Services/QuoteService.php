<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Quote;
use App\Models\QuoteVersion;
use App\Models\QuoteVersionEmail;
use App\Models\ShopOrder;
use App\Support\QuoteSnapshot;
use Carbon\Carbon;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\Process;

class QuoteService
{
    public function price(array $items, array $options = []): array
    {
        return app(CommerceService::class)->price($items, $options);
    }

    public function validate(Quote $quote): string
    {
        return Cache::lock('faw-quote-workflow', 120)->block(5, function () use ($quote) {
            $q = $quote->fresh();
            if ($q->status !== 'à valider') {
                throw ValidationException::withMessages(['status' => 'Ce devis est déjà traité.']);
            }
            $priced = $this->price(json_decode($q->sourceItems ?: $q->lines, true), ['note' => $q->note, 'custom' => $q->custom, 'kitLeaf' => $q->kitLeaf]);
            if ($q->reviewReasons || $priced['reasons']) {
                throw ValidationException::withMessages(['status' => 'Validation bloquée : '.($q->reviewReasons ?: implode(' ; ', $priced['reasons']))]);
            }
            if ($priced['total'] != $q->totalTtc) {
                throw ValidationException::withMessages(['status' => 'Les prix ont changé. Demander un nouveau devis.']);
            }
            $gen = json_decode($q->genInput, true);
            $gen['lignes'] = array_map(fn ($l) => ['reference' => $l['id'], 'qte' => $l['qty']] + ($l['override'] ? ['prix_ttc_walfar' => $l['unit']] : []) + (str_starts_with($l['id'], 'AUTO-GBAT300') && $q->kitLeaf ? ['largeur_vantail_m' => $q->kitLeaf] : []), $priced['lines']);
            $gen['date'] = now('Africa/Casablanca')->format('d/m/y');
            $dry = $this->generate($gen, 'TEST');
            if ($dry['total'] != $q->totalTtc) {
                throw ValidationException::withMessages(['status' => 'Prix différent du référentiel devis : validation bloquée.']);
            }
            if (! $q->number) {
                $proc = $this->process([config('faw.python'), $this->safePath('counter')]);
                $n = trim($proc->getOutput());
                if (! ctype_digit($n) || (int) $n < 1) {
                    throw new \RuntimeException('Compteur illisible.');
                }$q->number = $n;
                $q->save();
            }
            $result = $this->generate($gen, $q->number, true);
            if ($result['total'] != $q->totalTtc) {
                throw new \RuntimeException('Total du PDF incohérent. Numéro conservé pour réessai.');
            }
            DB::transaction(function () use ($q, $result, $priced, $gen) {
                $q->forceFill(['pdfFile' => basename($result['file']), 'status' => 'validé', 'validatedAt' => now(), 'versionNumber' => (string) $q->number])->save();
                // Version 1 = the reserved number itself; frozen as soon as its PDF exists.
                $this->recordVersion($q, 1, $priced['lines'], $gen, basename($result['file']), null);
            });

            return $this->sendEmail($q);
        });
    }

    protected function safePath(string $key): string
    {
        $p = config('faw.'.$key);
        if (! $p || ! is_file($p)) {
            throw new \RuntimeException('Configuration devis manquante : '.$key);
        }
        if ((app()->runningUnitTests() || app()->environment('testing')) && ! str_starts_with(realpath($p), '/tmp/')) {
            throw new \RuntimeException('Tests : chemins /tmp obligatoires.');
        }

        return $p;
    }

    protected function process(array $args): Process
    {
        $p = new Process($args, null, ['LANG' => 'C.UTF-8', 'PYTHONIOENCODING' => 'utf-8']);
        $p->setTimeout(30);
        $p->run();
        if (! $p->isSuccessful()) {
            throw new \RuntimeException('Générateur indisponible. Consultez la configuration devis.');
        }

        return $p;
    }

    protected function generate(array $input, string $number, bool $final = false, ?string $fileName = null): array
    {
        if ((app()->runningUnitTests() || app()->environment('testing')) && ! str_starts_with(config('faw.output'), '/tmp/')) {
            throw new \RuntimeException('Tests : sortie PDF /tmp obligatoire.');
        }
        $tmp = tempnam(sys_get_temp_dir(), 'faw-gen-');
        chmod($tmp, 0600);
        $file = $final ? rtrim(config('faw.output'), '/').'/'.($fileName ?? 'Devis-'.$number.'-FAW.pdf') : $tmp.'.pdf';
        if (! is_dir(dirname($file))) {
            mkdir(dirname($file), 0700, true);
        }
        try {
            file_put_contents($tmp, json_encode([...$input, 'numero' => $number, 'sortie' => $file], JSON_UNESCAPED_UNICODE));
            $p = $this->process([config('faw.python'), $this->safePath('generator'), $tmp]);
            if (! preg_match('/Total TTC ([\d.]+,\d{2}) DH/u', $p->getOutput(), $m) || ! is_file($file) || filesize($file) < 1000) {
                throw new \RuntimeException('PDF non produit.');
            }

            @chmod($file, 0600); // owner-only: served exclusively through authorized routes

            return ['file' => $file, 'total' => (int) round((float) str_replace(['.', ','], ['', '.'], $m[1]))];
        } finally {
            if (is_file($tmp)) {
                unlink($tmp);
            }
            if (! $final && is_file($file)) {
                unlink($file);
            }
        }
    }

    public function sendEmail(Quote $q, bool $resend = false): string
    {
        if (! EmailSettings::ready()) {
            return 'Devis validé. Email automatique désactivé (SMTP / Resend non configuré). Le lien privé débloque le PDF.';
        }
        if (! filter_var($q->email, FILTER_VALIDATE_EMAIL)) {
            return 'Devis validé, sans adresse email client. Lien privé disponible.';
        }
        if (! $q->pdfFile || ! in_array($q->status, ['validé', 'envoyé'])) {
            throw new \RuntimeException('Le devis doit être validé.');
        }
        $v = $this->ensureCurrentVersion($q);
        if (! $resend && $v->email_status === 'sent') {
            $this->journal($q, $v);
            $this->markDelivered($q);

            return 'Email déjà envoyé.';
        }
        if ($resend && $q->emailLastAttemptAt && now()->diffInSeconds(Carbon::parse($q->emailLastAttemptAt), true) < 20) {
            return 'Patientez 20 secondes avant de renvoyer.';
        }
        // Idempotency: one delivery row per attempt, claimed in a transaction under a unique key.
        $delivery = $this->claimDelivery($q, $v, $resend);
        if (! $delivery) {
            return 'Envoi déjà en cours ou déjà effectué pour la version '.$v->number.'.';
        }
        $v->refresh();
        $q->forceFill(['emailAttempts' => $q->emailAttempts + 1, 'emailLastAttemptAt' => now()])->save();
        $email = EmailSettings::resolve();
        try {
            $mail = $this->composeOutgoingMail($q, EmailSettings::salesperson());
            if ($email['transport'] === 'smtp') {
                config(['mail.mailers.faw_smtp' => ['transport' => 'smtp', 'scheme' => $email['scheme'] === 'ssl' ? 'smtps' : 'smtp', 'host' => $email['host'], 'port' => $email['port'], 'username' => $email['username'], 'password' => $email['password'], 'timeout' => 30, 'auto_tls' => true]]);
                Mail::purge('faw_smtp');
                $sent = Mail::mailer('faw_smtp')->html($mail['html'], function ($m) use ($email, $q, $mail) {
                    $m->from($email['from'], 'FAW Aluminium')->to($q->email)->subject($mail['subject']);
                    if (! empty($email['replyTo'])) {
                        $m->replyTo($email['replyTo']);
                    }
                    $m->text($mail['text']);
                    if (! empty($mail['logoPath'])) {
                        $m->getSymfonyMessage()->embedFromPath($mail['logoPath'], 'logo-faw', 'image/png');
                    }
                    $m->attach($mail['path'], ['as' => $mail['filename'], 'mime' => 'application/pdf']);
                });
                $messageId = $sent?->getMessageId();
                $provider = 'smtp';
            } else {
                $r = Http::timeout(30)->withToken($email['key'])->withHeaders(['Idempotency-Key' => $delivery->idempotency_key])->post('https://api.resend.com/emails', $this->resendPayload($email, $mail, $q->email));
                if (! $r->successful()) {
                    throw new \RuntimeException($this->mailFailureDetail($r->status(), is_string($r->json('message')) ? $r->json('message') : null));
                }
                $messageId = $r->json('id');
                $provider = 'resend';
            }
        } catch (\Throwable $e) {
            $detail = $e instanceof \RuntimeException ? $e->getMessage() : 'Transport email indisponible ; aucun envoi confirmé.';
            $q->forceFill(['emailStatus' => 'échec', 'emailError' => $detail])->save();
            $delivery->update(['status' => 'failed', 'provider' => $email['transport'] === 'smtp' ? 'smtp' : 'resend', 'error' => $detail, 'failed_at' => now()]);
            $v->update(['email_status' => 'failed', 'email_error' => $detail]);

            return 'PDF validé mais email non envoyé. '.$detail.' Vous pouvez renvoyer l’email plus tard, ou envoyer le lien privé au client.';
        }
        $q->forceFill(['emailStatus' => 'envoyé', 'emailSentAt' => now(), 'emailMessageId' => $messageId, 'emailError' => null])->save();
        $delivery->update(['status' => 'sent', 'provider' => $provider, 'message_id' => $messageId, 'sent_at' => now()]);
        $v->update(['email_status' => 'sent', 'email_message_id' => $messageId, 'email_error' => null, 'email_sent_at' => now()]);
        $this->journal($q, $v);
        $this->markDelivered($q);

        return 'Email envoyé au client, avec le PDF en pièce jointe.';
    }

    public function composeOutgoingMail(Quote $q, ?string $salesperson = null): array
    {
        $path = $this->quotePdfPath($q);
        $raw = file_get_contents($path);
        if ($raw === false || strlen($raw) < 1000) {
            throw new \RuntimeException('PDF introuvable.');
        }
        if (strlen($raw) > 35 * 1024 * 1024) {
            throw new \RuntimeException('Le PDF est trop volumineux pour être envoyé par e-mail.');
        }
        $name = trim((string) $q->clientName) !== '' ? (string) $q->clientName : 'client';
        $number = (string) ($q->versionNumber ?: $q->number);
        $total = (string) $q->totalTtc;
        $settings = EmailSettings::resolve();
        $phone = $settings['phone'] ?? '';
        $address = $settings['address'] ?? '';
        $commercial = $salesperson ?: EmailSettings::salesperson();
        $reply = $settings['replyTo'] ?: 'faw@faw.ma';
        if (str_contains($reply, '<') && preg_match('/<([^>]+)>/', $reply, $m)) {
            $reply = trim($m[1]);
        }
        $subject = 'Votre devis FAW n° '.$number;
        $headerLines = array_values(array_filter(['FAW Aluminium', $address !== '' ? $address : null, $phone !== '' ? 'Tél. '.$phone : null]));
        $signLines = array_values(array_filter([$commercial, 'Service commercial — FAW Aluminium', $phone !== '' ? 'Tél. '.$phone : null, $reply]));
        $text = implode("\n", $headerLines)."\n\nBonjour ".$name.",\n\nVeuillez trouver ci-joint votre devis FAW Aluminium n° ".$number.".\nTotal : ".$total." DH TTC (TVA 20 % incluse), valable 14 jours.\nRemise 0 %. Transport en option hors total. Installation non incluse. Pose non comprise.\n\nPour confirmer ou poser une question, répondez à cet e-mail.\n\n".implode("\n", $signLines);
        $esc = fn ($s) => htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $logo = EmailSettings::logoPath();
        $logoCell = $logo
            ? '<td valign="middle" style="width:148px;padding:0 16px 0 0;"><img src="cid:logo-faw" alt="FAW Aluminium" width="140" style="display:block;border:0;outline:none;width:140px;height:auto;max-width:140px;"></td>'
            : '';
        $meta = '<div style="font-size:16px;font-weight:bold;color:#F38F26;letter-spacing:0.02em;">FAW Aluminium</div>';
        if ($address !== '') {
            $meta .= '<div style="margin-top:6px;">'.$esc($address).'</div>';
        }
        if ($phone !== '') {
            $meta .= '<div style="margin-top:4px;">Tél. '.$esc($phone).'</div>';
        }
        $signHtml = '<p style="margin:20px 0 0;font-weight:bold;color:#432A13;">'.$esc($commercial).'</p><p style="margin:4px 0 0;color:#432A13;">Service commercial — FAW Aluminium</p>';
        if ($phone !== '') {
            $signHtml .= '<p style="margin:4px 0 0;color:#432A13;">Tél. '.$esc($phone).'</p>';
        }
        if ($reply !== '') {
            $signHtml .= '<p style="margin:4px 0 0;color:#432A13;">'.$esc($reply).'</p>';
        }
        $html = '<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,Helvetica,sans-serif;color:#432A13;">'
            .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ee;border-collapse:collapse;"><tr><td align="center" style="padding:24px 12px;">'
            .'<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-collapse:collapse;">'
            .'<tr><td style="background:#ffffff;padding:20px 24px 16px;border-top:4px solid #F38F26;border-bottom:1px solid #eadfd3;">'
            .'<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr>'
            .$logoCell
            .'<td valign="middle" style="color:#432A13;font-size:13px;line-height:1.45;">'.$meta.'</td>'
            .'</tr></table></td></tr>'
            .'<tr><td style="padding:28px 24px 8px;color:#432A13;font-size:15px;line-height:1.55;">'
            .'<p style="margin:0 0 16px;">Bonjour '.$esc($name).',</p>'
            .'<p style="margin:0 0 16px;">Veuillez trouver ci-joint votre devis FAW Aluminium n°&nbsp;<strong>'.$esc($number).'</strong>.</p>'
            .'<p style="margin:0 0 16px;">Total : <strong>'.$esc($total).' DH TTC</strong> (TVA 20&nbsp;% incluse), valable 14 jours.<br>Remise 0&nbsp;%. Transport en option hors total. Installation non incluse. Pose non comprise.</p>'
            .'<p style="margin:0;">Pour confirmer ou poser une question, répondez à cet e-mail.</p>'
            .'</td></tr>'
            .'<tr><td style="padding:8px 24px 28px;color:#432A13;font-size:14px;line-height:1.5;border-top:1px solid #F38F26;">'.$signHtml.'</td></tr>'
            .'</table></td></tr></table></body></html>';
        foreach ([$text, $html, $subject] as $part) {
            if (preg_match('/https?:\/\/|www\.|href\s*=|mailto:|tel:|devis\/suivi|devis\/pdf/i', $part)) {
                throw new \RuntimeException('Le corps de l’e-mail ne doit pas contenir de lien.');
            }
        }

        $mail = ['subject' => $subject, 'text' => $text, 'html' => $html, 'filename' => basename($path), 'path' => $path, 'content' => base64_encode($raw), 'bytes' => strlen($raw), 'logoPath' => $logo, 'logoContent' => null];
        if ($logo) {
            $mail['logoContent'] = base64_encode((string) file_get_contents($logo));
        }

        return $mail;
    }

    public function resendPayload(array $email, array $mail, string $to): array
    {
        $attachments = [['filename' => $mail['filename'], 'content' => $mail['content']]];
        if (! empty($mail['logoContent'])) {
            $attachments[] = ['filename' => 'logo-faw.png', 'content' => $mail['logoContent'], 'content_id' => 'logo-faw', 'content_type' => 'image/png'];
        }
        $payload = ['from' => $email['from'], 'to' => [$to], 'subject' => $mail['subject'], 'text' => $mail['text'], 'html' => $mail['html'], 'attachments' => $attachments];
        if (! empty($email['replyTo'])) {
            $payload['reply_to'] = $email['replyTo'];
        }

        return $payload;
    }

    protected function quotePdfPath(Quote $q): string
    {
        $name = basename((string) $q->pdfFile);
        if ($name === '' || $name !== $q->pdfFile || ! preg_match('/^Devis-\d+-FAW(?:-\d+)?\.pdf$/', $name)) {
            throw new \RuntimeException('PDF introuvable.');
        }
        $root = realpath((string) config('faw.output'));
        $path = $root ? realpath($root.'/'.$name) : false;
        if (! $root || ! $path || ! str_starts_with($path, rtrim($root, '/').'/') || ! is_file($path) || filesize($path) < 1000) {
            throw new \RuntimeException('PDF introuvable.');
        }

        return $path;
    }


    protected function mailFailureDetail(int $status = 0, ?string $detail = null): string
    {
        $haystack = strtolower((string) $detail);
        if ($status === 403 || str_contains($haystack, 'not verified') || str_contains($haystack, 'domain')) {
            return 'Le domaine d’expédition n’est pas encore vérifié chez Resend. Vérifiez faw.ma dans le tableau Resend, puis renvoyez l’email.';
        }

        return 'Transport email indisponible ; aucun envoi confirmé.';
    }

    protected function markDelivered(Quote $q): void
    {
        $q->forceFill(['status' => 'envoyé', 'sentAt' => now(), 'deliveredVia' => 'email'])->save();
        if ($q->orderId) {
            $o = ShopOrder::find($q->orderId);
            if ($o && $o->status !== 'devis envoyé') {
                Activity::create(['orderId' => $o->id, 'fromStatus' => $o->status, 'toStatus' => 'devis envoyé', 'createdAt' => now()]);
                $o->update(['status' => 'devis envoyé']);
            }
        }

    }

    protected function journal(Quote $q, ?QuoteVersion $v = null): void
    {
        $later = $v && $v->version > 1;
        if ($later ? QuoteVersion::find($v->id)->journaled : $q->fresh()->journaled) {
            return;
        }
        $path = $this->safePath('journal');
        $j = json_decode($q->journalInput, true);
        $number = $later ? $v->number : $q->number;
        $products = $later ? implode(' ; ', array_map(fn ($l) => $l['qty'].' x '.$l['reference'].' '.$l['name'].' '.$l['unit_ttc'], $v->lines)) : ($j['produits'] ?? '');
        $remark = $later ? 'site ; version '.$v->version.' du devis '.$q->number.' ; email '.$v->email_message_id : 'site ; devis validé ; email '.$q->emailMessageId;
        $cells = [$number, now('Africa/Casablanca')->format('Y-m-d H:i'), $j['last4'] ?? substr(preg_replace('/\D/', '', $q->phone), -4), $j['nom'] ?? $q->clientName, $products, $later ? $v->total_ttc : $q->totalTtc, $j['ville'] ?? $q->city, $remark];
        $cells = array_map(fn ($x) => preg_replace('/^[=+@\t-]+/', '', str_replace(["\r", "\n"], ' ', (string) $x)), $cells);
        $fh = fopen($path, 'a+b');
        if (! $fh || ! flock($fh, LOCK_EX)) {
            throw new \RuntimeException('Journal indisponible.');
        }
        try {
            // Read only for recovery/deduplication of this already-reserved number; never select a number from the journal.
            rewind($fh);
            $exists = false;
            while (($row = fgetcsv($fh, 0, ',', '"', '')) !== false) {
                if (count($row) >= 8 && (string) $row[0] === (string) $number && str_contains($row[7], 'site')) {
                    $exists = true;
                    break;
                }
            }
            if (! $exists) {
                $stat = fstat($fh);
                if ($stat['size'] > 0) {
                    fseek($fh, -1, SEEK_END);
                    if (fgetc($fh) !== "\n") {
                        fwrite($fh, "\n");
                    }
                } if (fputcsv($fh, $cells, ',', '"', '') === false) {
                    throw new \RuntimeException('Écriture journal impossible.');
                }
                fflush($fh);
            }
        } finally {
            flock($fh, LOCK_UN);
            fclose($fh);
        }
        if ($later) {
            $v->update(['journaled' => true]);

            return;
        }
        $q->journaled = true;
        $q->save();
        if ($v && ! $v->journaled) {
            $v->update(['journaled' => true]);
        }
    }

    /** Freeze an issued version (idempotent per quote + version: a retry returns the existing row untouched). */
    protected function recordVersion(Quote $q, int $version, array $pricedLines, array $gen, string $pdfFile, ?string $reason, ?string $deliveryLabel = null): QuoteVersion
    {
        $existing = QuoteVersion::where('quote_id', $q->id)->where('version', $version)->first();
        if ($existing) {
            return $existing;
        }
        $snap = QuoteSnapshot::build($pricedLines, $gen['transport'] ?? [], $deliveryLabel ?? (string) $q->transport, $q->kitLeaf !== null ? (float) $q->kitLeaf : null);
        $issued = now();
        $path = rtrim((string) config('faw.output'), '/').'/'.$pdfFile;
        unset($gen['numero'], $gen['sortie']);

        return QuoteVersion::create([
            'quote_id' => $q->id, 'version' => $version, 'number' => QuoteSnapshot::label((string) $q->number, $version),
            'lines' => $snap['lines'], 'delivery' => $snap['delivery'], 'totals' => $snap['totals'], 'total_ttc' => $snap['totals']['total_ttc'],
            'currency' => (string) config('faw.quote_currency', 'MAD'), 'validity_days' => (int) config('faw.quote_validity_days', 14),
            'valid_until' => QuoteSnapshot::validUntil($issued), 'conditions' => array_values((array) config('faw.quote_conditions', [])),
            'gen_input' => $gen, 'pdf_file' => $pdfFile, 'pdf_sha256' => is_file($path) ? hash_file('sha256', $path) : null,
            'issued_at' => $issued, 'reason' => $reason, 'created_by' => auth()->id(),
        ]);
    }

    /** Current version of a validated quote; version 1 is rebuilt from Quote data for quotes issued before versioning. */
    public function ensureCurrentVersion(Quote $q): QuoteVersion
    {
        $v = $q->currentVersion();
        if ($v) {
            return $v;
        }
        if (! $q->number || ! $q->pdfFile || ! in_array($q->status, ['validé', 'envoyé'])) {
            throw new \RuntimeException('Le devis doit être validé.');
        }
        $lines = json_decode((string) $q->lines, true) ?: [];
        $gen = json_decode((string) $q->genInput, true) ?: [];
        $gen['lignes'] = array_map(fn ($l) => ['reference' => $l['id'], 'qte' => (int) $l['qty']] + (! empty($l['override']) ? ['prix_ttc_walfar' => $l['unit']] : []), $lines);

        return $this->recordVersion($q, 1, $lines, $gen, (string) $q->pdfFile, 'Version initiale (reprise des données existantes)');
    }

    /** Claim one delivery attempt for a version. Null = already sent (auto) or another attempt is in flight. */
    protected function claimDelivery(Quote $q, QuoteVersion $v, bool $resend): ?QuoteVersionEmail
    {
        try {
            return DB::transaction(function () use ($q, $v, $resend) {
                $fresh = QuoteVersion::findOrFail($v->id);
                if (! $resend && $fresh->email_status === 'sent') {
                    return null;
                }
                $last = QuoteVersionEmail::where('quote_version_id', $v->id)->orderByDesc('id')->first();
                if ($last && $last->status === 'queued') {
                    if ($last->queued_at && $last->queued_at->gt(now()->subMinutes(10))) {
                        return null;
                    }
                    $last->update(['status' => 'failed', 'error' => 'Envoi interrompu (aucune confirmation).', 'failed_at' => now()]);
                }
                $attempt = (int) QuoteVersionEmail::where('quote_version_id', $v->id)->max('attempt') + 1;
                $delivery = QuoteVersionEmail::create([
                    'quote_version_id' => $v->id, 'attempt' => $attempt, 'idempotency_key' => 'faw-devis-'.$q->id.'-v'.$fresh->version.'-'.$attempt,
                    'kind' => $resend ? 'resend' : 'auto', 'status' => 'queued', 'queued_at' => now(),
                ]);
                $fresh->update(['email_status' => 'queued', 'email_error' => null]);

                return $delivery;
            });
        } catch (UniqueConstraintViolationException) {
            return null;
        }
    }

    /**
     * New version after a change of commercial terms (quantities, unit prices, delivery option) on a validated quote.
     * Never calls prochain_numero.py: the label derives from the reserved number. Previous PDFs are never overwritten.
     *
     * @param  array<int, array{position:int, qty:int, unit_ttc:int}>  $lines
     * @param  array{mode:string, ville?:?string, montant?:mixed}  $transport
     * @return array{0: QuoteVersion, 1: string}
     */
    public function createVersion(Quote $quote, array $lines, array $transport, string $reason, bool $send = true): array
    {
        $created = Cache::lock('faw-quote-workflow', 120)->block(5, function () use ($quote, $lines, $transport, $reason) {
            $q = $quote->fresh();
            if (! in_array($q->status, ['validé', 'envoyé']) || ! $q->number || ! $q->pdfFile) {
                throw ValidationException::withMessages(['status' => 'Le devis doit être validé (numéro réservé) avant une nouvelle version.']);
            }
            if (\App\Models\QuoteDecision::where('accepted_quote_id', $q->id)->exists()) {
                throw ValidationException::withMessages(['status' => 'Devis déjà accepté par le client : modifiez la commande, pas le devis.']);
            }
            $reason = trim($reason);
            if ($reason === '' || mb_strlen($reason) > 500) {
                throw ValidationException::withMessages(['reason' => 'Motif de la nouvelle version obligatoire (500 caractères maximum).']);
            }
            $cur = $this->ensureCurrentVersion($q);
            $byPos = collect($cur->lines)->keyBy('position');
            $priced = [];
            foreach (array_values($lines) as $in) {
                $base = $byPos->get((int) ($in['position'] ?? 0));
                $qty = filter_var($in['qty'] ?? null, FILTER_VALIDATE_INT);
                $unit = filter_var($in['unit_ttc'] ?? null, FILTER_VALIDATE_INT);
                if (! $base || $qty === false || $qty < 1 || $qty > 10000 || $unit === false || $unit < 1 || $unit > 10000000) {
                    throw ValidationException::withMessages(['lines' => 'Ligne invalide (quantité 1 à 10 000, prix unitaire TTC entier > 0).']);
                }
                $priced[] = ['id' => $base['reference'], 'title' => $base['name'], 'category' => $base['config']['category'] ?? null, 'qty' => $qty, 'unit' => $unit, 'total' => $qty * $unit, 'override' => true, 'leaf' => $base['config']['largeur_vantail_m'] ?? null];
            }
            if (! $priced) {
                throw ValidationException::withMessages(['lines' => 'Au moins une ligne est obligatoire.']);
            }
            $mode = (string) ($transport['mode'] ?? '');
            $ville = trim((string) ($transport['ville'] ?? '')) ?: null;
            $input = match ($mode) {
                'retrait' => ['mode' => 'retrait'],
                'a_confirmer' => array_filter(['mode' => 'a_confirmer', 'ville' => $ville]),
                'option' => ['mode' => 'option', 'ville' => $ville, 'montant' => filter_var($transport['montant'] ?? null, FILTER_VALIDATE_INT)],
                default => null,
            };
            if (! $input || ($mode === 'option' && (! $ville || ! $input['montant'] || $input['montant'] < 1))) {
                throw ValidationException::withMessages(['transport' => 'Livraison : retrait, option (ville et montant TTC > 0, hors total) ou à confirmer.']);
            }
            $sig = fn (array $ls, array $d) => json_encode([array_map(fn ($l) => [$l[0], $l[1], $l[2]], $ls), [$d['mode'] ?? null, $d['city'] ?? $d['ville'] ?? null, (int) ($d['amount_ttc'] ?? $d['montant'] ?? 0)]]);
            $old = $sig(array_map(fn ($l) => [$l['reference'], $l['qty'], $l['unit_ttc']], $cur->lines), $cur->delivery);
            $new = $sig(array_map(fn ($l) => [$l['id'], $l['qty'], $l['unit']], $priced), $input);
            if ($old === $new) {
                throw ValidationException::withMessages(['lines' => 'Aucune modification des conditions commerciales : pas de nouvelle version.']);
            }

            $n = $cur->version + 1;
            $label = QuoteSnapshot::label((string) $q->number, $n);
            $file = QuoteSnapshot::pdfName((string) $q->number, $n);
            if (is_file(rtrim((string) config('faw.output'), '/').'/'.$file) || QuoteVersion::where('pdf_file', $file)->orWhere('number', $label)->exists()) {
                throw new \RuntimeException('Le PDF ou le numéro de cette version existe déjà : rien n’est écrasé.');
            }
            $label_ = QuoteSnapshot::delivery($input)['label'];
            $expected = QuoteSnapshot::build($priced, $input, $label_)['totals']['total_ttc'];
            $gen = $cur->gen_input;
            $gen['lignes'] = array_map(fn ($l) => ['reference' => $l['id'], 'qte' => $l['qty'], 'prix_ttc_walfar' => $l['unit']] + ($l['leaf'] ? ['largeur_vantail_m' => $l['leaf']] : []), $priced);
            $gen['transport'] = $input;
            $gen['date'] = now('Africa/Casablanca')->format('d/m/y');
            unset($gen['numero'], $gen['sortie']);
            $dry = $this->generate($gen, 'TEST');
            if ($dry['total'] !== $expected) {
                throw ValidationException::withMessages(['lines' => 'Total différent du référentiel devis : version bloquée.']);
            }
            $result = $this->generate($gen, $label, true, $file);
            if ($result['total'] !== $expected) {
                throw new \RuntimeException('Total du PDF incohérent : version non enregistrée.');
            }
            $plain = array_map(fn ($l) => array_diff_key($l, ['leaf' => 1]), $priced);

            return DB::transaction(function () use ($q, $n, $plain, $gen, $file, $reason, $label, $label_, $expected) {
                $v = $this->recordVersion($q, $n, $plain, $gen, $file, $reason, $label_);
                $q->forceFill([
                    'pdfFile' => $file, 'versionNumber' => $label, 'totalTtc' => $expected, 'totalHt' => round($expected / 1.2, 2),
                    'lines' => json_encode($plain, JSON_UNESCAPED_UNICODE), 'transport' => $label_, 'status' => 'validé',
                    'emailStatus' => null, 'emailSentAt' => null, 'emailMessageId' => null, 'emailError' => null,
                    'customerDecision' => null, 'customerDecisionAt' => null,
                ])->save();

                return $v;
            });
        });

        $message = 'Version '.$created->number.' créée (PDF '.$created->pdf_file.').';
        if ($send) {
            $message .= ' '.Cache::lock('faw-quote-workflow', 120)->block(5, fn () => $this->sendEmail($quote->fresh()));
        }

        return [$created, $message];
    }

    public function versionPdf(QuoteVersion $v)
    {
        abort_unless(preg_match('/^Devis-\d+-FAW(?:-\d+)?\.pdf$/', (string) $v->pdf_file), 404);
        $root = realpath((string) config('faw.output'));
        $path = $root ? realpath($root.'/'.$v->pdf_file) : false;
        abort_unless($path && str_starts_with($path, rtrim($root, '/').'/') && is_file($path), 404);

        return response()->file($path, ['Cache-Control' => 'private, no-store', 'X-Robots-Tag' => 'noindex, nofollow', 'Referrer-Policy' => 'no-referrer']);
    }

    public function pdf(Quote $q)
    {
        abort_unless(in_array($q->status, ['validé', 'envoyé']) && preg_match('/^Devis-\d+-FAW(?:-\d+)?\.pdf$/', $q->pdfFile ?? ''), 404);
        $path = rtrim(config('faw.output'), '/').'/'.$q->pdfFile;
        abort_unless(is_file($path), 404);

        return response()->file($path, ['Cache-Control' => 'private, no-store', 'X-Robots-Tag' => 'noindex, nofollow', 'Referrer-Policy' => 'no-referrer']);
    }
}
