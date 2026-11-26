<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One delivery attempt of a quote version (queued -> sent | failed). idempotency_key is unique. */
class QuoteVersionEmail extends Model
{
    protected $table = 'quote_version_emails';

    protected $guarded = ['id'];

    protected function casts(): array
    {
        return ['queued_at' => 'immutable_datetime', 'sent_at' => 'immutable_datetime', 'failed_at' => 'immutable_datetime', 'attempt' => 'integer'];
    }
}
