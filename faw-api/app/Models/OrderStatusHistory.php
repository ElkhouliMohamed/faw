<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderStatusHistory extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'order_status_history';

    protected $guarded = ['id'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new \LogicException('Historique de statut : ajout seul.'));
        static::deleting(fn () => throw new \LogicException('Historique de statut : ajout seul.'));
    }
}
