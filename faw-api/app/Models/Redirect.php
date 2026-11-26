<?php

namespace App\Models;

use Illuminate\Validation\ValidationException;

class Redirect extends ShopModel
{
    protected static function booted(): void
    {
        parent::booted();
        static::saving(function ($r) {
            if (! preg_match('#^/(?!/)[^?\#<>]*$#', $r->from ?? '') || ! preg_match('#^/(?!/)[^<>]*$#', $r->to ?? '') || preg_match('#^/(admin|api|livewire|devis)(/|$)#', $r->from)) {
                throw ValidationException::withMessages(['from' => 'Chemin source ou destination non autorisé.']);
            }
            $next = $r->to;
            $seen = [$r->from];
            for ($i = 0; $i < 20; $i++) {
                $next = parse_url($next, PHP_URL_PATH);
                if (in_array($next, $seen, true)) {
                    throw ValidationException::withMessages(['to' => 'Boucle de redirection.']);
                }$seen[] = $next;
                $row = static::where('active', true)->where('from', $next)->whereKeyNot($r->getKey() ?? 0)->first();
                if (! $row) {
                    break;
                }$next = $row->to;
            }
        });
    }

    protected $table = 'Redirect';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['active' => 'boolean'];
}
