<?php

namespace App\Models;

use App\Services\ConfigDefinitions;

class SystemConfig extends ShopModel
{
    protected $table = 'SystemConfig';

    public $timestamps = true;

    protected $guarded = [];

    protected $hidden = ['value'];

    protected $casts = ['value' => 'encrypted:array'];

    public function formValues(): array
    {
        $v = $this->value ?? [];
        foreach (ConfigDefinitions::SECRETS as $key) {
            unset($v[$key]);
        }

return $v;
    }

    public function saveForm(array $fields): void
    {
        $before = $this->value ?? [];
        $allowed = array_column(ConfigDefinitions::all()[$this->name]['fields'], 0);
        $fields = array_intersect_key($fields, array_flip($allowed));
        foreach (ConfigDefinitions::SECRETS as $key) {
            if (empty($fields[$key])) {
                unset($fields[$key]);
            }
        }if (in_array($this->name, ['aramex', 'dynamics', 'analytics_api'])) {
            $fields['enabled'] = false;
        }
        if ($this->name === 'cmi') {
            // Card payment: only the owner (super admin) may switch it on, and only once the CMI credentials are complete.
            $merged = array_replace($before, $fields);
            $fields['enabled'] = ! empty($fields['enabled']) && (bool) auth()->user()?->canDo('*') && self::cmiCredentialsComplete($merged);
        }
        if ($this->name === 'shop') {
            $fields = self::cleanShopFields($fields);
        }
        if ($this->name === 'layout') {
            // Header / footer texts: icons from the whitelist, safe links, length limits (throws ValidationException).
            $fields = \App\Services\SiteLayout::normalize(array_replace(\App\Services\SiteLayout::defaults(), $before, $fields));
        }
        $this->value = array_replace($before, $fields);
        $this->save();
    }

    public static function cmiCredentialsComplete(array $v): bool
    {
        return trim((string) ($v['merchantId'] ?? '')) !== '' && trim((string) ($v['merchantSecret'] ?? '')) !== ''
            && (bool) preg_match('#^https://[a-z0-9.-]+(?::\d+)?/[^\s<>"]*$#i', (string) ($v['gatewayUrl'] ?? ''));
    }

    /** Payment settings typed in the back office: whole DH amount, known city slugs, RIB digits only. */
    private static function cleanShopFields(array $f): array
    {
        if (array_key_exists('codMaxAmount', $f)) {
            $n = is_numeric($f['codMaxAmount']) ? (int) $f['codMaxAmount'] : 0;
            $f['codMaxAmount'] = $n > 0 ? min($n, 100000000) : null;
        }
        if (array_key_exists('codCities', $f)) {
            $f['codCities'] = array_values(array_unique(array_filter(array_map(fn ($c) => is_string($c) && preg_match('/^[a-z0-9-]{1,60}$/', $c) ? $c : null, is_array($f['codCities']) ? $f['codCities'] : []))));
        }
        if (array_key_exists('bankRib', $f)) {
            $f['bankRib'] = $f['bankRib'] === null ? null : preg_replace('/\D/', '', (string) $f['bankRib']);
        }
        foreach (['bankTransferEnabled', 'codEnabled', 'showPrices'] as $k) {
            if (array_key_exists($k, $f)) {
                $f[$k] = (bool) $f[$k];
            }
        }

        return $f;
    }

    public static function settings(string $name): array
    {
        return static::where('name', $name)->first()?->value ?? ConfigDefinitions::all()[$name]['defaults'] ?? [];
    }
}
