<?php

namespace App\Payments;

use App\Models\Payment;
use Illuminate\Http\Request;

/**
 * Card payment skeleton (NAPS / Payzone / CMI — see docs/payment-providers.md). DISABLED: enabled() is false
 * and the webhook answers 503. The signature/amount/currency/reference checks below are the contract a real
 * adapter must keep; the real field names, signature scheme and endpoints come from the chosen provider.
 */
class CardProvider implements PaymentProvider
{
    public function key(): string
    {
        return 'card';
    }

    public function label(): string
    {
        return 'Carte bancaire (désactivée)';
    }

    public function enabled(): bool
    {
        return false; // no contract, no provider: card payment is not offered
    }

    public function instructions(Payment $payment): array
    {
        return ['method' => 'card', 'available' => false];
    }

    public function acceptsProof(): bool
    {
        return false;
    }

    protected function secret(): string
    {
        return (string) config('faw.card.webhook_secret');
    }

    public function parseWebhook(Request $request): WebhookNotification
    {
        $secret = $this->secret();
        if ($secret === '') {
            throw new WebhookRejected('not_configured', 503);
        }
        $raw = $request->getContent();
        $sig = (string) $request->header('X-Faw-Signature');
        if ($sig === '' || ! hash_equals(hash_hmac('sha256', $raw, $secret), $sig)) {
            throw new WebhookRejected('bad_signature', 401);
        }
        $d = json_decode($raw, true);
        if (! is_array($d) || ! is_string($d['event_id'] ?? null) || ! is_string($d['reference'] ?? null) || ! is_int($d['amount'] ?? null) || ! is_string($d['currency'] ?? null)) {
            throw new WebhookRejected('bad_payload', 422);
        }

        return new WebhookNotification($d['event_id'], $d['reference'], $d['amount'], strtoupper($d['currency']), ($d['status'] ?? '') === 'paid', isset($d['transaction_id']) ? (string) $d['transaction_id'] : null);
    }
}
