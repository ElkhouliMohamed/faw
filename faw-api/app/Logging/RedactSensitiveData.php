<?php

namespace App\Logging;

use Illuminate\Log\Logger;
use Monolog\LogRecord;

/** Monolog tap: masks quote link tokens, secrets, e-mails and phone numbers before anything reaches the log file. */
class RedactSensitiveData
{
    private const PATTERNS = [
        '~((?:api/quotes|devis/(?:suivi|confirmation|pdf))/)[\w-]{32}~' => '$1[jeton]',
        '~\b(re|sk|pk|rk)_[A-Za-z0-9_]{12,}~' => '[clé]',
        '~(Bearer\s+)[A-Za-z0-9._\-]+~i' => '$1[jeton]',
        '~base64:[A-Za-z0-9+/=]{20,}~' => '[clé]',
        '~("?(?:password|passwd|secret|token|tokenHash|api_?key|merchantSecret|resendKey)"?\s*[:=]>?\s*)("[^"]*"|\'[^\']*\'|[^\s,}\]]+)~i' => '$1[masqué]',
        '~[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}~' => '[email]',
        '~(?<!\d)(?:\+212|00212|0)[5-7](?:[\s.\-]?\d){8}(?!\d)~' => '[téléphone]',
    ];

    public function __invoke(Logger $logger): void
    {
        foreach ($logger->getHandlers() as $handler) {
            $handler->pushProcessor(fn (LogRecord $record) => $record->with(
                message: self::redact($record->message),
                context: self::redactArray($record->context),
                extra: self::redactArray($record->extra),
            ));
        }
    }

    public static function redact(string $text): string
    {
        return (string) preg_replace(array_keys(self::PATTERNS), array_values(self::PATTERNS), $text);
    }

    private static function redactArray(array $data): array
    {
        array_walk_recursive($data, function (&$v, $k) {
            if (is_string($k) && preg_match('/password|secret|token|api_?key|authorization|cookie/i', $k)) {
                $v = '[masqué]';
            } elseif (is_string($v)) {
                $v = self::redact($v);
            }
        });

        return $data;
    }
}
