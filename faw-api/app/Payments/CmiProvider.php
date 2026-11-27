<?php

namespace App\Payments;

use App\Models\Payment;
use App\Services\CheckoutSettings;
use Illuminate\Http\Request;

/**
 * CMI (Centre Monétique Interbancaire) — 3D Pay Hosting, hash « ver3 » (SHA-512, base64).
 * The customer is sent to the CMI page with a signed form; the payment is confirmed ONLY by the signed
 * server-to-server callback (CmiController::callback), never by the browser return.
 * Disabled unless the owner switched it on in Filament with complete credentials (CheckoutSettings::cmiReady()).
 */
class CmiProvider implements PaymentProvider
{
    public const CURRENCY_MAD = '504';

    public function key(): string
    {
        return 'cmi';
    }

    public function label(): string
    {
        return 'Carte bancaire (CMI)';
    }

    public function enabled(): bool
    {
        return CheckoutSettings::cmiReady();
    }

    public function instructions(Payment $payment): array
    {
        return ['method' => 'cmi', 'available' => $this->enabled(), 'reference' => $payment->reference, 'amount' => $payment->amount, 'currency' => $payment->currency];
    }

    public function acceptsProof(): bool
    {
        return false;
    }

    /** The generic JSON webhook is not used for CMI (form callback with its own signature). */
    public function parseWebhook(Request $request): WebhookNotification
    {
        throw new WebhookRejected('use_cmi_callback', 404);
    }

    public static function amount(int $dh): string
    {
        return number_format($dh, 2, '.', '');
    }

    /**
     * Signed form for the CMI hosted page.
     *
     * @param  array{email?: ?string, name?: string, phone?: ?string, company?: ?string}  $customer
     * @return array{action: string, fields: array<string, string>}
     */
    public function form(Payment $payment, array $customer, string $okUrl, string $failUrl, string $callbackUrl, string $shopUrl): array
    {
        $c = CheckoutSettings::cmiCredentials();
        $fields = [
            'clientid' => $c['clientId'],
            'storetype' => '3D_PAY_HOSTING',
            'TranType' => 'PreAuth',
            'amount' => self::amount((int) $payment->amount),
            'currency' => self::CURRENCY_MAD,
            'oid' => (string) $payment->reference,
            'okUrl' => $okUrl,
            'failUrl' => $failUrl,
            'callbackUrl' => $callbackUrl,
            'shopurl' => $shopUrl,
            'lang' => 'fr',
            'rnd' => bin2hex(random_bytes(10)),
            'hashAlgorithm' => 'ver3',
            'encoding' => 'UTF-8',
            'AutoRedirect' => 'true',
            'CallbackResponse' => 'true',
            'email' => mb_substr((string) ($customer['email'] ?? ''), 0, 64),
            'BillToName' => mb_substr(self::plain((string) ($customer['name'] ?? '')), 0, 64),
            'BillToCompany' => mb_substr(self::plain((string) ($customer['company'] ?? '')), 0, 64),
            'tel' => mb_substr((string) ($customer['phone'] ?? ''), 0, 32),
        ];
        $fields['HASH'] = self::hash($fields, $c['storeKey']);

        return ['action' => $c['gatewayUrl'], 'fields' => $fields];
    }

    /** CMI ver3: parameters sorted case-insensitively (hash / encoding excluded), values escaped and joined with « | », store key last. */
    public static function hash(array $params, string $storeKey): string
    {
        $keys = array_keys($params);
        natcasesort($keys);
        $plain = '';
        foreach ($keys as $k) {
            $lower = strtolower((string) $k);
            if ($lower === 'hash' || $lower === 'encoding') {
                continue;
            }
            $value = trim(html_entity_decode(preg_replace("/\n$/", '', (string) $params[$k]) ?? '', ENT_QUOTES, 'UTF-8'));
            $plain .= self::escape($value).'|';
        }
        $plain .= self::escape($storeKey);

        return base64_encode(pack('H*', hash('sha512', $plain)));
    }

    public static function verify(array $params, string $storeKey): bool
    {
        $received = (string) ($params['HASH'] ?? $params['hash'] ?? '');

        return $received !== '' && $storeKey !== '' && hash_equals(self::hash($params, $storeKey), $received);
    }

    private static function escape(string $v): string
    {
        return str_replace('|', '\\|', str_replace('\\', '\\\\', $v));
    }

    private static function plain(string $v): string
    {
        return trim(preg_replace('/[\x00-\x1F<>"]+/u', ' ', $v) ?? '');
    }
}
