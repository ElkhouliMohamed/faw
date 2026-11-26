<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Customer decision audit trail (accepted / refused / modification_requested). Append-only. */
class QuoteDecision extends Model
{
    protected $table = 'quote_decisions';

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Décision client : journal en ajout seul.'));
        static::deleting(fn () => throw new \LogicException('Décision client : journal en ajout seul.'));
    }
}
