<?php

namespace App\Models;

use App\Casts\ShopTimestamp;
use Carbon\CarbonInterface;

class Quote extends ShopModel
{
    /** Raw link tokens: 24 random bytes, base64url, 32 characters. Only their sha256 is stored. */
    public const TOKEN_PATTERN = '/^[\w-]{32}$/';

    protected static function booted(): void
    {
        parent::booted();
        static::creating(function (Quote $q) {
            $raw = (string) $q->getAttribute('token');
            if ($raw !== '' && ! self::isHash($raw)) {
                $q->setAttribute('tokenHash', self::hashToken($raw));
                $q->setAttribute('token', $q->getAttribute('tokenHash'));
            }
            if ($q->getAttribute('tokenHash') && ! $q->getAttribute('tokenExpiresAt')) {
                $q->setAttribute('tokenExpiresAt', self::defaultExpiry());
            }
        });
        static::created(function ($q) {
            InboxMessage::create(['kind' => 'quote', 'quoteId' => $q->id, 'contactId' => $q->contactId, 'name' => $q->clientName, 'phone' => $q->phone, 'email' => $q->email, 'city' => $q->city, 'subject' => 'Demande de devis', 'message' => $q->note ?: 'Demande à valider dans Devis.']);
        });
    }

    protected $table = 'Quote';

    public $timestamps = false;

    protected $guarded = [];

    protected $hidden = ['token', 'tokenHash'];

    protected function casts(): array
    {
        return [...parent::casts(), 'journaled' => 'boolean', 'custom' => 'boolean', 'tokenExpiresAt' => ShopTimestamp::class, 'tokenRevokedAt' => ShopTimestamp::class, 'customerDecisionAt' => ShopTimestamp::class];
    }

    public function versions(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(QuoteVersion::class, 'quote_id')->orderBy('version');
    }

    public function currentVersion(): ?QuoteVersion
    {
        return QuoteVersion::where('quote_id', $this->id)->orderByDesc('version')->first();
    }

    public static function newRawToken(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(24)), '+/', '-_'), '=');
    }

    public static function hashToken(string $raw): string
    {
        return hash('sha256', $raw);
    }

    protected static function isHash(string $value): bool
    {
        return (bool) preg_match('/^[0-9a-f]{64}$/', $value);
    }

    public static function defaultExpiry(): CarbonInterface
    {
        return now()->addDays(max(1, (int) config('faw.quote_link_ttl_days', 90)));
    }

    /** Active link only: right format, known hash, not revoked, not expired. Same null result for every failure. */
    public static function findByRawToken(string $raw): ?self
    {
        if (! preg_match(self::TOKEN_PATTERN, $raw)) {
            return null;
        }

        return static::query()
            ->where('tokenHash', self::hashToken($raw))
            ->whereNull('tokenRevokedAt')
            ->where('tokenExpiresAt', '>', now()->getTimestampMs())
            ->first();
    }

    public function linkState(): string
    {
        if ($this->tokenRevokedAt) {
            return 'révoqué';
        }
        if (! $this->tokenExpiresAt || $this->tokenExpiresAt->isPast()) {
            return 'expiré';
        }

        return 'actif';
    }

    public function revokeLink(): void
    {
        $this->forceFill(['tokenRevokedAt' => now()])->save();
    }

    /** Issues a fresh link (old one stops working) and returns the raw token once; it is never stored. */
    public function regenerateLink(): string
    {
        $raw = self::newRawToken();
        $hash = self::hashToken($raw);
        $this->forceFill(['token' => $hash, 'tokenHash' => $hash, 'tokenExpiresAt' => self::defaultExpiry(), 'tokenRevokedAt' => null])->save();

        return $raw;
    }
}
