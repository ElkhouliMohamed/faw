<?php

namespace App\Casts;

use Carbon\CarbonImmutable;
use Illuminate\Contracts\Database\Eloquent\CastsAttributes;
use Illuminate\Database\Eloquent\Model;

/** Accept historical Prisma epoch milliseconds and SQLite text defaults; write epoch milliseconds for compatibility. */
class ShopTimestamp implements CastsAttributes
{
    public function get(Model $model, string $key, mixed $value, array $attributes): ?CarbonImmutable
    {
        if ($value === null) {
            return null;
        }

        return is_numeric($value) ? CarbonImmutable::createFromTimestampMs((int) $value, 'UTC') : CarbonImmutable::parse($value, 'UTC');
    }

    public function set(Model $model, string $key, mixed $value, array $attributes): ?int
    {
        if ($value === null) {
            return null;
        }
        if (is_numeric($value)) {
            return (int) $value;
        }

        return CarbonImmutable::parse($value, 'UTC')->getTimestampMs();
    }
}
