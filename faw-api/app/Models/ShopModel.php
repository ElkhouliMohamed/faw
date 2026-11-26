<?php

namespace App\Models;

use App\Casts\ShopTimestamp;
use App\Services\CommerceService;
use App\Services\ContentBlocks;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

abstract class ShopModel extends Model
{
    protected function casts(): array
    {
        return array_fill_keys(['createdAt', 'updatedAt', 'lastActivityAt', 'validatedAt', 'sentAt', 'cancelledAt', 'emailSentAt', 'emailLastAttemptAt', 'at', 'startsAt', 'endsAt', 'remindedAt'], ShopTimestamp::class);
    }

    protected static function booted(): void
    {
        static::saving(function ($m) {
            $columns = Schema::getColumns($m->getTable());
            foreach ($columns as $column) {
                $name = $column['name'];
                if ($name === 'updatedAt' && ! ($m instanceof Cart)) {
                    $m->setAttribute($name, now());
                }
                if ($m->getAttribute($name) === null && ! $column['nullable'] && in_array(strtolower($column['type_name']), ['text', 'varchar']) && $column['default'] !== null && $name !== $m->getKeyName()) {
                    $default = trim($column['default'], "'\"");
                    if (in_array($m->getCasts()[$name] ?? null, ['array', 'json', 'object'], true)) {
                        $default = json_decode($default, true);
                    }
                    $m->setAttribute($name, $default);
                }
            }
            if ($m instanceof Promotion || $m instanceof Coupon || $m instanceof Popup) {
                if ($m->startsAt && $m->endsAt && $m->endsAt < $m->startsAt) {
                    throw ValidationException::withMessages(['endsAt' => 'La fin doit être après le début.']);
                }
            }
            if ($m instanceof LandingPage) {
                $m->blocks = ContentBlocks::normalize($m->blocks ?? []);
            }
            if ($m instanceof Bundle) {
                app(CommerceService::class)->validateBundle($m);
            }

            if ($m instanceof Product || $m instanceof Category) {
                foreach (['title', 'description', 'shortDescription', 'seoTitle', 'metaTitle', 'metaDescription', 'label'] as $k) {
                    $v = $m->getAttribute($k);
                    if ($v && preg_match('/EI'.'120|normes? europ[ée]ennes|portes? de se'.'cours/iu', $v)) {
                        throw ValidationException::withMessages([$k => 'Formulation non autorisée.']);
                    }
                }
            }
            if ($m instanceof Customer) {
                if ($m->tags === null) {
                    $m->tags = '';
                }$m->lastActivityAt = now();
            }
            if ($m instanceof Product) {
                foreach (['seoTitle', 'metaTitle', 'metaDescription', 'badges', 'attributes'] as $k) {
                    if ($m->getAttribute($k) === null) {
                        $m->setAttribute($k, $k === 'attributes' ? '{}' : '');
                    }
                }$m->updatedAt = now();
            }
            if ($m instanceof Category) {
                foreach (['short', 'description', 'seoTitle', 'seoDescription'] as $k) {
                    if ($m->getAttribute($k) === null) {
                        $m->setAttribute($k, '');
                    }
                }$m->updatedAt = now();
            }
            if ($m instanceof Setting) {
                if ($m->value === null) {
                    $m->value = '';
                }$m->updatedAt = now();
                $m->updatedBy = auth()->user()?->email;
            }
            if (! ($m instanceof Cart) && array_key_exists('updatedAt', $m->getAttributes())) {
                $m->updatedAt = now();
            }
        });
        foreach (['created', 'updated', 'deleted'] as $event) {
            static::$event(function ($m) use ($event) {
                if (auth()->check() && ! ($m instanceof AuditEntry)) {
                    AuditEntry::create(['actor' => auth()->user()->email, 'action' => $event, 'entity' => $m->getTable(), 'entityId' => (string) $m->getKey(), 'summary' => 'Action back-office', 'at' => now(), 'changes' => AuditEntry::safeChanges($m, $event)]);
                }
            });
        }
    }
}
