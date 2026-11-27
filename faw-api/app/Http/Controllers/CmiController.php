<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Payments\CmiProvider;
use App\Services\CheckoutSettings;
use App\Services\PaymentService;
use App\Support\PaymentStatus;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * CMI 3D Pay Hosting.
 *  - callback: server-to-server, signed (HASH ver3). The ONLY place a card payment is confirmed. Answers the
 *    plain-text protocol CMI expects (« ACTION=POSTAUTH » to capture, « APPROVED » acknowledged, « FAILURE »).
 *  - return: the customer's browser coming back from CMI. Never changes anything, only redirects to the order page.
 */
class CmiController extends Controller
{
    public function __construct(private PaymentService $payments) {}

    public function callback(Request $r): Response
    {
        $text = fn (string $s) => response($s, 200, ['Content-Type' => 'text/plain; charset=UTF-8', 'Cache-Control' => 'no-store']);
        if (! CheckoutSettings::cmiReady()) {
            return $text('FAILURE');
        }
        $params = $r->request->all();
        if (! CmiProvider::verify($params, CheckoutSettings::cmiCredentials()['storeKey'])) {
            return $text('FAILURE');
        }
        $payment = Payment::where('reference', (string) ($params['oid'] ?? ''))->where('provider', 'cmi')->first();
        if (! $payment) {
            return $text('FAILURE');
        }
        $approved = ($params['ProcReturnCode'] ?? '') === '00' && strcasecmp((string) ($params['Response'] ?? ''), 'Approved') === 0;
        $amountOk = ($params['amount'] ?? '') === CmiProvider::amount((int) $payment->amount) && (string) ($params['currency'] ?? '') === CmiProvider::CURRENCY_MAD && $payment->currency === 'MAD';
        $eventId = (string) ($params['TransId'] ?? '') !== '' ? 'trans-'.$params['TransId'] : 'h-'.hash('sha256', $r->getContent());
        $meta = ['procReturnCode' => mb_substr((string) ($params['ProcReturnCode'] ?? ''), 0, 8), 'response' => mb_substr((string) ($params['Response'] ?? ''), 0, 32), 'authCode' => mb_substr((string) ($params['AuthCode'] ?? ''), 0, 16)];

        try {
            return DB::transaction(function () use ($payment, $approved, $amountOk, $eventId, $r, $params, $meta, $text) {
                DB::table('payment_webhook_events')->insert(['provider' => 'cmi', 'event_id' => mb_substr($eventId, 0, 128), 'payload_hash' => hash('sha256', $r->getContent()), 'result' => $approved && $amountOk ? 'paid' : 'refused', 'created_at' => now()]);
                if ($approved && $amountOk) {
                    if ($payment->status !== PaymentStatus::Confirmed) {
                        $this->payments->confirm($payment, null, 'Paiement carte CMI accepté', 'webhook', isset($params['TransId']) ? mb_substr((string) $params['TransId'], 0, 128) : null);
                    }

                    return $text('ACTION=POSTAUTH');
                }
                $this->payments->markFailed($payment, $amountOk ? 'Paiement carte CMI refusé ou abandonné.' : 'Notification CMI : montant ou devise incohérent.', $r->ip(), $meta);

                return $text('APPROVED');
            });
        } catch (UniqueConstraintViolationException) {
            return $text($approved && $amountOk ? 'ACTION=POSTAUTH' : 'APPROVED'); // already processed
        }
    }

    /** Browser return (ok / fail). The payment status shown on the order page comes from the callback only. */
    public function back(Request $r, string $result)
    {
        $payment = Payment::where('reference', (string) $r->input('oid', ''))->where('provider', 'cmi')->first();
        $number = $payment?->shopOrder?->number;
        $shop = rtrim((string) (config('faw.shop_url') ?: config('app.url')), '/');
        $target = $number ? $shop.'/commande/confirmation/'.$number.'?paiement='.($result === 'ok' ? 'ok' : 'echec') : $shop.'/panier';

        return redirect()->away($target, 303)->header('Cache-Control', 'no-store')->header('Referrer-Policy', 'no-referrer');
    }
}
