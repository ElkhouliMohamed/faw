<?php

namespace App\Services;

use App\Models\SystemConfig;

/**
 * Payment methods offered at checkout, as configured in Filament (Réglages boutique + Paiement CMI).
 * Keys used by the storefront and the « Order » table: virement | reception | carte.
 */
class CheckoutSettings
{
    public const METHODS = ['virement', 'reception', 'carte'];

    /** Payment provider stored on the payment row, per checkout method. */
    public const PROVIDERS = ['virement' => 'bank_transfer', 'reception' => 'cash_on_delivery', 'carte' => 'cmi'];

    /** @return array<string, mixed> */
    public static function shop(): array
    {
        $defaults = \App\Services\ConfigDefinitions::all()['shop']['defaults'];

        return array_replace($defaults, SystemConfig::settings('shop'));
    }

    public static function bankTransferEnabled(): bool
    {
        return (bool) (self::shop()['bankTransferEnabled'] ?? true);
    }

    public static function codEnabled(): bool
    {
        return (bool) (self::shop()['codEnabled'] ?? false);
    }

    public static function codMaxAmount(): ?int
    {
        $n = self::shop()['codMaxAmount'] ?? null;

        return is_numeric($n) && (int) $n > 0 ? (int) $n : null;
    }

    /** @return list<string> empty = every city */
    public static function codCities(): array
    {
        $c = self::shop()['codCities'] ?? [];

        return is_array($c) ? array_values(array_filter($c, 'is_string')) : [];
    }

    /** CMI is offered only when the owner switched it on AND the credentials are complete. Default: off. */
    public static function cmiReady(): bool
    {
        $v = SystemConfig::settings('cmi');

        return ! empty($v['enabled']) && SystemConfig::cmiCredentialsComplete($v);
    }

    /** @return array{clientId: string, storeKey: string, gatewayUrl: string} */
    public static function cmiCredentials(): array
    {
        $v = SystemConfig::settings('cmi');

        return ['clientId' => trim((string) ($v['merchantId'] ?? '')), 'storeKey' => (string) ($v['merchantSecret'] ?? ''), 'gatewayUrl' => trim((string) ($v['gatewayUrl'] ?? ''))];
    }

    /** Bank details shown after a bank-transfer order: back-office values first, then FAW_BANK_* (never invented). */
    public static function bank(): array
    {
        $s = self::shop();
        $pick = function (string $setting, string $config) use ($s): ?string {
            $v = trim((string) ($s[$setting] ?? ''));
            if ($v === '') {
                $v = trim((string) config('faw.bank.'.$config));
            }

            return $v !== '' ? $v : null;
        };

        return ['rib' => $pick('bankRib', 'rib'), 'iban' => $pick('bankIban', 'iban'), 'holder' => $pick('bankHolder', 'holder'), 'bankName' => $pick('bankName', 'bank_name'), 'branch' => $pick('bankBranch', 'branch'), 'swift' => $pick('bankSwift', 'swift')];
    }

    /**
     * Methods for a cart. $mode = delivery mode (city slug | autre | livraison | transporteur | retrait), $total = TTC.
     *
     * @return list<array{key: string, available: bool, reason: ?string}>
     */
    public static function methods(int $total, string $mode): array
    {
        $out = [];
        if (self::bankTransferEnabled()) {
            $out[] = ['key' => 'virement', 'available' => true, 'reason' => null];
        }
        if (self::codEnabled()) {
            $reason = null;
            $max = self::codMaxAmount();
            $cities = self::codCities();
            if ($max !== null && $total > $max) {
                $reason = 'cod_max';
            } elseif ($mode !== 'retrait' && $cities !== [] && ! in_array($mode, $cities, true)) {
                $reason = 'cod_city';
            }
            $out[] = ['key' => 'reception', 'available' => $reason === null, 'reason' => $reason];
        }
        if (self::cmiReady()) {
            $out[] = ['key' => 'carte', 'available' => $total > 0, 'reason' => null];
        }

        return $out;
    }
}
