<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Payments\PaymentProviders;
use App\Payments\WebhookRejected;
use App\Services\PaymentService;
use App\Support\PaymentStatus;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Card-provider notifications. While no provider is enabled (today) every call answers 503 and changes nothing.
 * Contract for a future adapter: valid signature, MAD only, known reference of the same provider, exact amount,
 * each event processed once (idempotent).
 */
class PaymentWebhookController extends Controller
{
    public function __construct(private PaymentProviders $providers, private PaymentService $payments) {}

    public function __invoke(Request $request, string $provider): JsonResponse
    {
        $adapter = $this->providers->get($provider);
        if (! $adapter || ! $adapter->enabled() || $provider === 'bank_transfer') {
            return response()->json(['error' => 'payment_provider_disabled'], 503);
        }
        try {
            $n = $adapter->parseWebhook($request);
        } catch (WebhookRejected $e) {
            return response()->json(['error' => $e->reason], $e->status);
        }
        if ($n->currency !== 'MAD') {
            return response()->json(['error' => 'bad_currency'], 422);
        }
        $payment = Payment::where('reference', $n->reference)->where('provider', $provider)->first();
        if (! $payment) {
            return response()->json(['error' => 'unknown_reference'], 404);
        }
        if ($n->amount !== $payment->amount || $payment->currency !== 'MAD') {
            return response()->json(['error' => 'amount_mismatch'], 422);
        }

        try {
            return DB::transaction(function () use ($provider, $n, $payment, $request) {
                DB::table('payment_webhook_events')->insert(['provider' => $provider, 'event_id' => $n->eventId, 'payload_hash' => hash('sha256', $request->getContent()), 'result' => $n->paid ? 'paid' : 'ignored', 'created_at' => now()]);
                if ($n->paid && $payment->status !== PaymentStatus::Confirmed) {
                    $this->payments->confirm($payment, null, 'Notification '.$provider.' '.$n->eventId, 'webhook', $n->transactionId);
                }

                return response()->json(['ok' => true]);
            });
        } catch (UniqueConstraintViolationException) {
            return response()->json(['ok' => true, 'duplicate' => true]); // already processed
        }
    }
}
