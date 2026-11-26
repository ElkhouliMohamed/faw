<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditEntry extends ShopModel
{
    protected $table = 'AuditLog';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [];

    /** @var list<string> */
    private const SECRET_KEYS = [
        'password', 'passwordHash', 'remember_token', 'token',
        'resendKey', 'smtpPassword', 'mailPassword', 'merchantSecret',
        'clientSecret', 'serviceAccountJson', 'refreshToken', 'app_authentication_recovery_codes',
        'secret', 'apiKey', 'APP_KEY', 'hash',
    ];

    public static function isSecretKey(string $key): bool
    {
        $normalized = strtolower($key);
        if (in_array($key, ['tokenExpiresAt', 'tokenRevokedAt'], true)) {
            return false; // link lifecycle dates are not secrets and must stay auditable
        }
        if (in_array($key, self::SECRET_KEYS, true) || in_array($normalized, array_map('strtolower', self::SECRET_KEYS), true)) {
            return true;
        }

        return (bool) preg_match('/password|secret|token|passwd|apikey|api_key|private.?key|hash$/i', $key);
    }

    public static function safeChanges(Model $model, string $event): ?string
    {
        $attrs = match ($event) {
            'created' => $model->getAttributes(),
            'deleted' => $model->getOriginal(),
            default => $model->getChanges(),
        };
        unset($attrs['updatedAt'], $attrs['updated_at'], $attrs['createdAt'], $attrs['created_at'], $attrs['remember_token']);
        $clean = [];
        foreach ($attrs as $key => $value) {
            if (self::isSecretKey((string) $key)) {
                $clean[$key] = '[masqué]';

                continue;
            }
            if (is_string($value) && strlen($value) > 2000) {
                $value = substr($value, 0, 2000).'…';
            }
            if (is_array($value) || is_object($value)) {
                $value = json_encode($value, JSON_UNESCAPED_UNICODE);
            }
            $clean[$key] = $value;
        }

        return $clean === [] ? null : json_encode($clean, JSON_UNESCAPED_UNICODE);
    }
}
