<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Http\Request;

/** Virement bancaire : coordonnées lues uniquement depuis la config (FAW_BANK_*), jamais inventées. */
class BankTransferProvider implements PaymentProvider
{
    public function key(): string
    {
        return 'bank_transfer';
    }

    public function label(): string
    {
        return 'Virement bancaire';
    }

    public function enabled(): bool
    {
        return true;
    }

    public static function bank(): array
    {
        $v = fn (string $k) => ($s = trim((string) config('faw.bank.'.$k))) !== '' ? $s : null;

        return ['rib' => $v('rib'), 'iban' => $v('iban'), 'holder' => $v('holder'), 'bankName' => $v('bank_name'), 'branch' => $v('branch'), 'swift' => $v('swift')];
    }

    public function instructions(Payment $payment): array
    {
        return ['method' => 'bank_transfer', 'reference' => $payment->reference, 'amount' => $payment->amount, 'currency' => $payment->currency] + self::bank();
    }

    public function acceptsProof(): bool
    {
        return true;
    }

    public function parseWebhook(Request $request): WebhookNotification
    {
        throw new WebhookRejected('no_webhook', 404);
    }
}
