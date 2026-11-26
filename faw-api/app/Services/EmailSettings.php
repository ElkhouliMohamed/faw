<?php

namespace App\Services;

use App\Models\Setting;
use App\Models\SystemConfig;

class EmailSettings
{
    // Valeurs déjà publiées : Paramètres du back-office, pied de site, modèle de devis (generer_devis.py / MODELE-devis-617.pdf). Jamais inventées.
    public const FALLBACK_PHONE = '+212 522 865 202';

    public const FALLBACK_ADDRESS = '21 Rue Al Yazidi Mohamed, Casablanca';

    public const FALLBACK_SALESPERSON = 'Walid';

    public static function filled(?string $value): ?string
    {
        $v = trim((string) $value);

        return $v !== '' ? $v : null;
    }

    public static function setting(string $key): ?string
    {
        return static::filled(Setting::query()->where('key', $key)->value('value'));
    }

    public static function logoPath(): ?string
    {
        foreach ([public_path('brand/logo-faw.png'), base_path('../faw-shop/public/brand/logo-faw.png')] as $candidate) {
            $path = realpath($candidate);
            if ($path && is_file($path) && filesize($path) > 100 && filesize($path) < 500000) {
                return $path;
            }
        }

        return null;
    }

    public static function resolve(): array
    {
        $v = SystemConfig::settings('notifications');

        return [
            'enabled' => $v['enabled'] ?? true,
            'transport' => $v['transport'] ?? 'resend',
            'from' => $v['emailFrom'] ?? config('faw.email_from'),
            'replyTo' => $v['emailReplyTo'] ?? config('faw.email_reply_to'),
            'phone' => static::filled($v['emailPhone'] ?? null) ?? static::setting('phone') ?? static::FALLBACK_PHONE,
            'address' => static::filled($v['emailAddress'] ?? null) ?? static::setting('office_address') ?? static::FALLBACK_ADDRESS,
            'salesperson' => static::filled($v['salespersonName'] ?? null) ?? static::FALLBACK_SALESPERSON,
            'key' => $v['resendKey'] ?? config('faw.resend_key'),
            'host' => $v['smtpHost'] ?? config('mail.mailers.smtp.host'),
            'port' => $v['smtpPort'] ?? config('mail.mailers.smtp.port', 587),
            'scheme' => $v['smtpScheme'] ?? 'tls',
            'username' => $v['smtpUsername'] ?? config('mail.mailers.smtp.username'),
            'password' => $v['smtpPassword'] ?? config('mail.mailers.smtp.password'),
        ];
    }

    public static function salesperson(?string $override = null): string
    {
        $fallback = static::resolve()['salesperson'] ?: static::FALLBACK_SALESPERSON;
        $name = trim((string) ($override ?? auth()->user()?->name ?? ''));
        $company = static::setting('company_name') ?? 'FAW Aluminium';
        if ($name === '' || strcasecmp($name, $company) === 0 || strcasecmp($name, 'FAW Aluminium') === 0) {
            return $fallback;
        }

        return $name;
    }

    public static function ready(): bool
    {
        $v = static::resolve();

        return $v['enabled'] && $v['from'] && ($v['transport'] === 'smtp' ? ($v['host'] && $v['username'] && $v['password'] && (bool) filter_var($v['from'], FILTER_VALIDATE_EMAIL)) : (bool) $v['key']);
    }
}
