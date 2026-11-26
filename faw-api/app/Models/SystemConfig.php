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
        }if (in_array($this->name, ['cmi', 'aramex', 'dynamics', 'analytics_api'])) {
            $fields['enabled'] = false;
        }$this->value = array_replace($before, $fields);
        $this->save();
    }

    public static function settings(string $name): array
    {
        return static::where('name', $name)->first()?->value ?? ConfigDefinitions::all()[$name]['defaults'] ?? [];
    }
}
