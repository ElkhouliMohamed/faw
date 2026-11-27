<?php

namespace App\Payments;

use App\Models\Payment;
use App\Services\CheckoutSettings;
use Illuminate\Http\Request;

/** Paiement à la livraison / au retrait : encaissé par FAW ou le livreur, confirmé à la main par la finance. */
class CashOnDeliveryProvider implements PaymentProvider
{
    public function key(): string
    {
        return 'cash_on_delivery';
    }

    public function label(): string
    {
        return 'Paiement à la livraison / au retrait';
    }

    public function enabled(): bool
    {
        return CheckoutSettings::codEnabled();
    }

    public function instructions(Payment $payment): array
    {
        return ['method' => 'cash_on_delivery', 'reference' => $payment->reference, 'amount' => $payment->amount, 'currency' => $payment->currency];
    }

    public function acceptsProof(): bool
    {
        return false;
    }

    public function parseWebhook(Request $request): WebhookNotification
    {
        throw new WebhookRejected('no_webhook', 404);
    }
}
