<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Hashed 6-digit e-mail code for a quote acceptance (10 minutes, 5 attempts). Never stores the code. */
class QuoteOtp extends Model
{
    protected $table = 'quote_otps';

    protected $guarded = ['id'];

    protected $hidden = ['code_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'immutable_datetime', 'consumed_at' => 'immutable_datetime', 'locked_at' => 'immutable_datetime', 'attempts' => 'integer'];
    }

    public static function hashCode(int $quoteId, string $code): string
    {
        return hash_hmac('sha256', $quoteId.'|'.$code, (string) config('app.key'));
    }
}
