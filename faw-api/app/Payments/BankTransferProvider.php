<?php

namespace App\Payments;

use App\Models\Payment;
use App\Services\CheckoutSettings;
use Illuminate\Http\Request;

/** Virement bancaire : coordonnées lues depuis le back-office ou la config (FAW_BANK_*), jamais inventées. */
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

    /** Always valid for existing payments (quote orders); the checkout offer follows CheckoutSettings. */
    public function enabled(): bool
    {
        return true;
    }

    /** Back-office values (Réglages boutique) first, then FAW_BANK_*; null = « communiqué par FAW ». */
    public static function bank(): array
    {
        return CheckoutSettings::bank();
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
