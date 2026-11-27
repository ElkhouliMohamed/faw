<?php

namespace App\Http\Controllers;

use App\Models\Activity;
use App\Models\Category;
use App\Models\Customer;
use App\Models\Product;
use App\Models\Quote;
use App\Models\ShopOrder;
use App\Services\CheckoutService;
use App\Services\CheckoutSettings;
use App\Services\CommerceService;
use App\Services\PriceVisibility;
use App\Services\QuoteService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StoreController extends Controller
{
    public function catalog()
    {
        return response()->json(Product::where('active', true)->orderBy('sortOrder')->get()->map(fn ($p) => $this->publicProduct($p)));
    }

    public function product(string $slug)
    {
        return response()->json($this->publicProduct(Product::where('active', true)->where('slug', $slug)->firstOrFail()));
    }

    protected function publicProduct(Product $p): array
    {
        $priced = app(CommerceService::class)->productPrice($p);
        // priceMode: « online » = price + add to cart; « quote » = no price at all (product « sur devis » or prices hidden globally).
        $row = [...$p->only(['id', 'slug', 'title', 'seoTitle', 'description', 'shortDescription', 'price', 'category', 'brand', 'image', 'availability', 'stockQty', 'priceToConfirm', 'stockToConfirm', 'variantGroup', 'variantLabel', 'sortOrder', 'active', 'metaTitle', 'metaDescription', 'h1', 'attributes', 'badges', 'warrantyId', 'details', 'installationGuide', 'datasheet', 'maintenanceGuide']), 'stockNote' => null, 'updatedAt' => $p->updatedAt?->toIso8601String(), 'basePrice' => $p->price, ...$priced, 'orderable' => PriceVisibility::orderable($p, (int) ($priced['price'] ?? $p->price)),
            'priceMode' => PriceVisibility::mode($p), 'maxOnlineQty' => $p->maxOnlineQty !== null ? (int) $p->maxOnlineQty : null, 'taxRate' => CheckoutService::TAX_RATE];

        return PriceVisibility::sanitizeProduct($row);
    }

    public function categories()
    {
        return Category::where('active', true)->orderBy('sortOrder')->get(['id', 'parentId', 'slug', 'label', 'short', 'family', 'description', 'image', 'seoTitle', 'seoDescription', 'h1', 'sortOrder']);
    }

    public function submit(Request $r, QuoteService $service, bool $quote = false)
    {
        $r->merge(['phone' => preg_replace('/[\s.()\-]/', '', (string) $r->input('phone')), 'ice' => $r->filled('ice') ? preg_replace('/\s+/', '', (string) $r->input('ice')) : null]);
        $orderRules = $quote ? ['cartId' => ['nullable', 'regex:/^[a-z0-9]{16,40}$/'], 'fromCart' => ['sometimes', 'boolean']] : [
            'paymentMethod' => ['required', Rule::in(CheckoutSettings::METHODS)], 'cgv' => ['accepted'],
            'fulfilment' => ['sometimes', Rule::in(['livraison', 'retrait'])], 'citySlug' => ['nullable', 'regex:/^[a-z0-9-]{1,60}$/'],
        ];
        $v = $r->validate($orderRules + [
            'name' => ['required', 'string', 'min:2', 'max:80'], 'phone' => ['required', 'regex:/^(?:\+212|00212|0)[5-7]\d{8}$/'], 'email' => ['required', 'email', 'max:120'],
            'city' => ['required', 'string', 'min:2', 'max:60'], 'clientType' => ['sometimes', Rule::in(['particulier', 'entreprise'])],
            'company' => ['nullable', 'string', 'max:120'], 'ice' => ['nullable', 'regex:/^\d{15}$/'], 'address' => ['nullable', 'string', 'max:300'],
            'items' => ['required', 'array', 'min:1', 'max:20'], 'items.*.id' => ['required', 'string', 'max:90'], 'items.*.qty' => ['required', 'integer', 'min:1', 'max:999'],
            'note' => ['nullable', 'string', 'max:600'], 'custom' => ['sometimes', 'boolean'], 'kitLeaf' => ['nullable', 'numeric', 'min:0.3', 'max:10'],
            'coupon' => ['nullable', 'string', 'max:40'], 'attribution' => ['sometimes', 'array'], 'attribution.utmSource' => ['nullable', 'string', 'max:60'], 'attribution.utmMedium' => ['nullable', 'string', 'max:60'], 'attribution.utmCampaign' => ['nullable', 'string', 'max:100'], 'cartId' => ['nullable', 'regex:/^[a-z0-9]{16,40}$/'], 'pickup' => ['sometimes', 'boolean'], 'deliveryMode' => ['nullable', 'string', 'max:60'],
        ], ['cgv.accepted' => 'Veuillez accepter les conditions générales de vente.', 'paymentMethod.in' => 'Mode de paiement non disponible.']);
        if (($v['clientType'] ?? '') === 'entreprise' && empty($v['company'])) {
            throw ValidationException::withMessages(['company' => 'Raison sociale requise.']);
        }
        if (! $quote) {
            // Online order: CheckoutService recomputes every amount and checks the payment method server-side.
            $pickup = ($v['pickup'] ?? false) || ($v['fulfilment'] ?? '') === 'retrait' || ($v['deliveryMode'] ?? '') === 'retrait';
            $v['pickup'] = $pickup;
            $v['deliveryMode'] = $pickup ? 'retrait' : ($v['citySlug'] ?? $v['deliveryMode'] ?? null);

            return response()->json(app(CheckoutService::class)->place($v), 201)->header('Cache-Control', 'no-store');
        }
        $priced = $service->price($v['items'], $v);
        $token = Quote::newRawToken();
        $result = DB::transaction(function () use ($v, $priced, $token) {
            $phone = $v['phone'];
            if (str_starts_with($phone, '0')) {
                $phone = str_starts_with($phone, '00212') ? '+'.substr($phone, 2) : '+212'.substr($phone, 1);
            }
            $client = Customer::updateOrCreate(['phone' => $phone], ['name' => $v['name'], 'email' => $v['email'] ?? null, 'city' => $v['city'], 'company' => $v['company'] ?? null, 'ice' => $v['ice'] ?? null, 'type' => $v['clientType'] ?? 'particulier', 'source' => 'site', 'lastActivityAt' => now()]);
            $pickup = $v['pickup'] ?? false;
            $transportData = app(CommerceService::class)->quoteTransport($priced['lines'], $v['city'], $pickup);
            $transport = $transportData['input'];
            $transportLabel = $transportData['label'];
            $number = 'FAW-'.now()->format('ymd').'-'.strtoupper(bin2hex(random_bytes(16)));
            $o = ShopOrder::create(['number' => $number, 'contactId' => $client->id, 'customerName' => $v['name'], 'phone' => $phone, 'email' => $v['email'] ?? null, 'city' => $v['city'], 'address' => $v['address'] ?? '', 'company' => $v['company'] ?? null, 'ice' => $v['ice'] ?? null, 'deliveryMode' => $pickup ? 'retrait' : 'autre', 'deliveryFee' => 0, 'deliveryNote' => $transportLabel, 'paymentMethod' => 'à définir', 'clientType' => $v['clientType'] ?? 'particulier', 'notes' => $v['note'] ?? null, 'subtotal' => $priced['total'], 'total' => $priced['total'], 'couponCode' => null, 'couponDiscount' => 0, 'cartId' => $v['cartId'] ?? null, 'utmSource' => $v['attribution']['utmSource'] ?? null, 'utmMedium' => $v['attribution']['utmMedium'] ?? null, 'utmCampaign' => $v['attribution']['utmCampaign'] ?? null, 'quoteRefusal' => $priced['reasons'] ? implode(' ; ', $priced['reasons']) : null]);
            foreach ($priced['lines'] as $l) {
                DB::table('OrderItem')->insert(['orderId' => $o->id, 'productId' => $l['id'], 'title' => $l['title'], 'category' => $l['category'], 'unitPrice' => $l['unit'], 'quantity' => $l['qty'], 'lineTotal' => $l['total']]);
            }
            Activity::create(['orderId' => $o->id, 'toStatus' => 'nouveau', 'createdAt' => now()]);
            if (! empty($v['cartId'])) {
                // « Transformer en demande de devis » : the cart is kept for analytics, marked as converted.
                DB::table('Cart')->where('id', $v['cartId'])->where(fn ($q) => $q->whereNull('status')->orWhere('status', '!=', 'récupéré'))->update(['status' => 'devis', 'orderNumber' => $number, 'updatedAt' => now()->getTimestampMs()]);
            }
            DB::table('Event')->insert(['type' => 'quote_request', 'path' => '/devis', 'source' => $v['attribution']['utmSource'] ?? null, 'medium' => $v['attribution']['utmMedium'] ?? null, 'campaign' => $v['attribution']['utmCampaign'] ?? null, 'value' => $priced['total']]);
            $name = ($v['clientType'] ?? '') === 'entreprise' ? $v['company'] : $v['name'];
            $gen = ['client' => $name, 'telephone' => $phone, 'ville' => $v['city'], 'transport' => $transport, 'lignes' => array_map(function ($l) use ($v) {
                return ['reference' => $l['id'], 'qte' => $l['qty']] + ($l['override'] ? ['prix_ttc_walfar' => $l['unit']] : []) + (str_starts_with($l['id'], 'AUTO-GBAT300') && ! empty($v['kitLeaf']) ? ['largeur_vantail_m' => $v['kitLeaf']] : []);
            }, $priced['lines'])];
            if (! empty($v['ice'])) {
                $gen['ice'] = $v['ice'];
            }
            Quote::create(['orderId' => $o->id, 'contactId' => $client->id, 'clientName' => $name, 'clientType' => $v['clientType'] ?? 'particulier', 'phone' => $phone, 'email' => $v['email'] ?? null, 'city' => $v['city'], 'totalHt' => round($priced['total'] / 1.2, 2), 'totalTtc' => $priced['total'], 'transport' => $transportLabel, 'sourceItems' => json_encode($v['items']), 'lines' => json_encode($priced['lines'], JSON_UNESCAPED_UNICODE), 'genInput' => json_encode($gen, JSON_UNESCAPED_UNICODE), 'journalInput' => json_encode(['last4' => substr(preg_replace('/\D/', '', $phone), -4), 'nom' => $name.' ; formulaire site', 'produits' => implode(' ; ', array_map(fn ($l) => $l['qty'].' x '.$l['id'].' '.$l['title'].' '.$l['unit'], $priced['lines'])), 'ville' => $transportLabel], JSON_UNESCAPED_UNICODE), 'token' => $token, 'note' => $v['note'] ?? null, 'custom' => $v['custom'] ?? false, 'kitLeaf' => $v['kitLeaf'] ?? null, 'reviewReasons' => $priced['reasons'] ? implode(' ; ', $priced['reasons']) : null]);

            return ['token' => $token, 'status' => 'à valider'];
        });

        return response()->json($result, 201)->header('Cache-Control', 'no-store');
    }

    public function coupon(Request $r)
    {
        $v = $r->validate(['code' => ['required', 'string', 'max:40'], 'items' => ['required', 'array', 'min:1', 'max:20'], 'items.*.id' => ['required', 'string', 'max:90'], 'items.*.qty' => ['required', 'integer', 'min:1', 'max:500']]);
        if (! PriceVisibility::showOnSite()) {
            return response()->json(['code' => $v['code'], 'discount' => null, 'hidden' => true]);
        }
        $commerce = app(CommerceService::class);

        return response()->json($commerce->coupon($v['code'], $commerce->price($v['items'])['total']));
    }

    public function quote(Request $r, QuoteService $service)
    {
        return $this->submit($r, $service, true);
    }

    public function follow(string $token)
    {
        $q = $this->findToken($token);
        $valid = in_array($q->status, ['validé', 'envoyé']);

        $payload = ['status' => $q->status, 'number' => $valid ? $q->number : null, 'pdf' => $valid && $q->pdfFile ? '/api/quotes/'.$token.'/pdf' : null];
        if (PriceVisibility::showOnSite()) {
            $payload['totalTtc'] = $q->totalTtc;
        }

        return response()->json($payload)->header('Cache-Control', 'private, no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }

    public function pdf(string $token, QuoteService $s)
    {
        return $s->pdf($this->findToken($token));
    }

    protected function findToken(string $token): Quote
    {
        $q = Quote::findByRawToken($token);
        abort_unless($q !== null, 404);

        return $q;
    }
}
