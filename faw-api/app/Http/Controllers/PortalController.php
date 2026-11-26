<?php

namespace App\Http\Controllers;

use App\Models\CustomerOrder;
use App\Models\Payment;
use App\Models\Quote;
use App\Services\PaymentService;
use App\Services\QuotePortal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Customer portal API, called server-side by the Next shop (127.0.0.1) from its Server Actions
 * (Origin-checked, CSRF-safe). Reads are GET; every side effect is an explicit POST.
 */
class PortalController extends Controller
{
    public function __construct(private QuotePortal $portal, private PaymentService $payments) {}

    public function show(string $token): JsonResponse
    {
        return $this->json($this->portal->state($this->quote($token)));
    }

    public function otp(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['versionId' => ['required', 'integer']]);

        return $this->result($this->portal->requestOtp($this->quote($token), (int) $data['versionId'], $this->clientIp($request)));
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['versionId' => ['required', 'integer'], 'code' => ['required', 'string', 'max:12'], 'confirm' => ['required', 'boolean']]);
        [$ip, $ua] = [$this->clientIp($request), $this->clientUa($request)];

        return $this->result($this->portal->accept($this->quote($token), (int) $data['versionId'], preg_replace('/\D/', '', $data['code']), (bool) $data['confirm'], $ip, $ua));
    }

    public function refuse(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['versionId' => ['required', 'integer'], 'reason' => ['nullable', 'string', 'max:1000']]);

        return $this->result($this->portal->refuse($this->quote($token), (int) $data['versionId'], $data['reason'] ?? null, $this->clientIp($request), $this->clientUa($request)));
    }

    public function modification(Request $request, string $token): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:2000']]);

        return $this->result($this->portal->requestModification($this->quote($token), $data['message'], $this->clientIp($request), $this->clientUa($request)));
    }

    /** Bank-transfer proof (pdf/jpg/png, 5 MB, real MIME checked server-side, private storage). */
    public function proof(Request $request, string $token, int $payment): JsonResponse
    {
        $q = $this->quote($token);
        $order = CustomerOrder::where('quote_id', $q->id)->first();
        $p = $order ? Payment::where('customer_order_id', $order->id)->find($payment) : null;
        abort_unless($p !== null, 404);
        $key = 'faw-portal-proof:'.$q->id;
        if (RateLimiter::tooManyAttempts($key, 6)) {
            return $this->result(['ok' => false, 'code' => 'rate_limited', 'retryAfter' => RateLimiter::availableIn($key)]);
        }
        RateLimiter::hit($key, 3600);
        $file = $request->file('proof');
        if (! $file instanceof UploadedFile) {
            return $this->result(['ok' => false, 'code' => 'proof_missing']);
        }

        return $this->result($this->payments->uploadProof($p, $file, $this->clientIp($request)));
    }

    protected function quote(string $token): Quote
    {
        $q = Quote::findByRawToken($token);
        abort_unless($q !== null, 404);

        return $q;
    }

    protected function fromShop(Request $request): bool
    {
        return in_array($request->ip(), ['127.0.0.1', '::1'], true);
    }

    /** The shop forwards the visitor's address; trusted only when the call comes from the local shop process. */
    protected function clientIp(Request $request): ?string
    {
        $fwd = $this->fromShop($request) ? trim((string) $request->header('X-Faw-Client-Ip')) : '';

        return filter_var($fwd, FILTER_VALIDATE_IP) ? $fwd : $request->ip();
    }

    protected function clientUa(Request $request): ?string
    {
        $ua = $this->fromShop($request) ? $request->header('X-Faw-Client-Ua') : null;

        return mb_substr((string) ($ua ?: $request->userAgent()), 0, 500) ?: null;
    }

    protected function result(array $r): JsonResponse
    {
        return $this->json($r, $r['ok'] ? 200 : ($r['code'] === 'rate_limited' ? 429 : 422));
    }

    protected function json(array $payload, int $status = 200): JsonResponse
    {
        return response()->json($payload, $status)->header('Cache-Control', 'private, no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }
}
