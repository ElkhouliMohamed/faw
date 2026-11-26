<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Append-only payment history. */
class PaymentTransaction extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['meta' => 'array', 'amount' => 'integer'];
    }

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Historique de paiement : lecture seule.'));
        static::deleting(fn () => throw new \LogicException('Historique de paiement : lecture seule.'));
    }
}
