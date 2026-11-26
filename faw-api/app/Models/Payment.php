<?php

namespace App\Models;

use App\Support\PaymentStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    protected $guarded = ['id'];

    /** Amount, reference and order never change once created (a new schedule cancels and recreates). */
    public const FROZEN = ['customer_order_id', 'position', 'amount', 'currency', 'reference', 'provider'];

    protected function casts(): array
    {
        return ['status' => PaymentStatus::class, 'amount' => 'integer', 'proof_size' => 'integer', 'proof_uploaded_at' => 'datetime', 'confirmed_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(function (Payment $p) {
            if ($p->isDirty(self::FROZEN)) {
                throw new \LogicException('Paiement : montant et référence non modifiables.');
            }
        });
        static::deleting(fn () => throw new \LogicException('Paiement : suppression interdite (annulez-le).'));
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(CustomerOrder::class, 'customer_order_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(PaymentTransaction::class)->orderBy('id');
    }
}
