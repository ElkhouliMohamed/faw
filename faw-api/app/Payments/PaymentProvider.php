<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Http\Request;

/** Adapter for one way of paying. Only bank transfer is active; card adapters stay disabled until FAW signs a contract. */
interface PaymentProvider
{
    public function key(): string;

    public function label(): string;

    public function enabled(): bool;

    /** Customer-facing instructions for this payment (null values = "communiqué par FAW"). */
    public function instructions(Payment $payment): array;

    public function acceptsProof(): bool;

    /** Verify the signature and parse a provider notification. Throws WebhookRejected. */
    public function parseWebhook(Request $request): WebhookNotification;
}
