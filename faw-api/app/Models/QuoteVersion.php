<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Immutable snapshot of an issued quote (one row per version, never updated except its delivery status, never deleted).
 */
class QuoteVersion extends Model
{
    /** The only columns that may change after issue: email delivery tracking and the journal flag. */
    public const MUTABLE = ['email_status', 'email_message_id', 'email_error', 'email_sent_at', 'journaled', 'updated_at'];

    protected $table = 'quote_versions';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return [
            'lines' => 'array', 'delivery' => 'array', 'totals' => 'array', 'conditions' => 'array', 'gen_input' => 'array',
            'issued_at' => 'immutable_datetime', 'email_sent_at' => 'immutable_datetime', 'journaled' => 'boolean',
            'version' => 'integer', 'total_ttc' => 'integer', 'validity_days' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::updating(function (QuoteVersion $v) {
            $frozen = array_diff(array_keys($v->getDirty()), self::MUTABLE);
            if ($frozen) {
                throw new \LogicException('Version de devis émise : contenu figé ('.implode(', ', $frozen).').');
            }
        });
        static::deleting(fn () => throw new \LogicException('Version de devis émise : suppression interdite.'));
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    public function emails(): HasMany
    {
        return $this->hasMany(QuoteVersionEmail::class, 'quote_version_id')->orderBy('id');
    }
}
