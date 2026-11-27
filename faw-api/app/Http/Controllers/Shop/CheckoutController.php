<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\ShopOrder;
use App\Payments\CmiProvider;
use App\Services\CheckoutService;
use App\Services\PaymentService;
use App\Support\PaymentStatus;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Storefront checkout endpoints called by the Next server (faw-shop). The order number (128 random bits) is the
 * only key to a site order; nothing here lists orders or returns another customer's data.
 */
class CheckoutController extends Controller
{
    /** Site orders stay reachable from their confirmation link this long (same rule as ShopDataController::order). */
    public const ORDER_DAYS = 30;

    /** Cart / checkout summary computed by the server: totals HT/TVA/TTC, shipping, coupon, payment methods. */
    public function preview(Request $r, CheckoutService $checkout): JsonResponse
    {
        $v = $r->validate([
            'items' => ['required', 'array', 'min:1', 'max:20'], 'items.*.id' => ['required', 'string', 'max:90'], 'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
            'deliveryMode' => ['nullable', 'string', 'max:60'], 'pickup' => ['sometimes', 'boolean'], 'coupon' => ['nullable', 'string', 'max:40'],
        ]);

        return response()->json($checkout->preview($v))->header('Cache-Control', 'no-store');
    }

    public static function findOrder(string $number): ShopOrder
    {
        abort_unless(preg_match('/^FAW-\d{6}-[0-9A-F]{32}$/', $number), 404);
        $o = ShopOrder::where('number', $number)->first();
        abort_unless($o && $o->createdAt && $o->createdAt->gt(now()->subDays(self::ORDER_DAYS)), 404);

        return $o;
    }

    /** Bank-transfer proof from the order confirmation page (same checks as the quote portal: real MIME, 5 MB, private disk). */
    public function proof(Request $r, string $number, PaymentService $payments): JsonResponse
    {
        $o = self::findOrder($number);
        $p = Payment::where('shop_order_id', $o->id)->where('provider', 'bank_transfer')->whereIn('status', [PaymentStatus::Awaiting->value, PaymentStatus::Rejected->value])->orderBy('id')->first();
        if (! $p || in_array((string) $o->status, ShopOrder::FINAL, true)) {
            return $this->json(['ok' => false, 'code' => 'proof_not_allowed'], 422);
        }
        $file = $r->file('proof');
        if (! $file) {
            return $this->json(['ok' => false, 'code' => 'proof_missing'], 422);
        }
        $res = $payments->uploadProof($p, $file, $this->clientIp($r));

        return $this->json($res, $res['ok'] ? 200 : 422);
    }

    /** Signed CMI form for a card-payment order (only while CMI is enabled and the payment is still open). */
    public function cmi(string $number, CmiProvider $cmi): JsonResponse
    {
        $o = self::findOrder($number);
        $p = Payment::where('shop_order_id', $o->id)->where('provider', 'cmi')->where('status', PaymentStatus::Awaiting->value)->orderBy('id')->first();
        if (! $p || ! $cmi->enabled() || in_array((string) $o->status, ShopOrder::FINAL, true)) {
            return $this->json(['ok' => false, 'code' => 'card_unavailable'], 409);
        }
        $shop = rtrim((string) (config('faw.shop_url') ?: config('app.url')), '/');
        $form = $cmi->form($p, ['email' => $o->email, 'name' => $o->customerName, 'phone' => $o->phone, 'company' => $o->company],
            $shop.'/api/payments/cmi/return/ok', $shop.'/api/payments/cmi/return/fail', $shop.'/api/payments/cmi/callback', $shop.'/');

        return $this->json(['ok' => true] + $form);
    }

    /** The shop forwards the visitor's address; trusted only from the local shop process (like the quote portal). */
    protected function clientIp(Request $r): ?string
    {
        $fwd = in_array($r->ip(), ['127.0.0.1', '::1'], true) ? trim((string) $r->header('X-Faw-Client-Ip')) : '';

        return filter_var($fwd, FILTER_VALIDATE_IP) ? $fwd : $r->ip();
    }

    protected function json(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }
}
