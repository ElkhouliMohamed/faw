<?php

namespace App\Support;

use Illuminate\Http\Request;

final class LocaleHelper
{
    public const SUPPORTED = ['fr', 'ar'];

    public const DEFAULT = 'fr';

    public static function current(?Request $request = null): string
    {
        $r = $request ?? request();
        if (! $r) {
            return self::DEFAULT;
        }

        $param = $r->query('locale') ?? $r->query('lang') ?? $r->header('X-Locale');
        if (is_string($param)) {
            $normalized = strtolower(trim($param));
            if (in_array($normalized, self::SUPPORTED, true)) {
                return $normalized;
            }
        }

        $accept = $r->header('Accept-Language');
        if (is_string($accept)) {
            $lang = strtolower(substr(trim($accept), 0, 2));
            if ($lang === 'ar') {
                return 'ar';
            }
        }

        return self::DEFAULT;
    }

    public static function isArabic(?Request $request = null): bool
    {
        return self::current($request) === 'ar';
    }

    public static function trans(mixed $ar, mixed $fr, ?string $locale = null): mixed
    {
        $loc = $locale ?? self::current();
        if ($loc === 'ar' && $ar !== null && $ar !== '') {
            return $ar;
        }

        return $fr;
    }
}
