<?php

namespace App\Http\Controllers\Shop;

use App\Http\Controllers\Controller;
use App\Models\Attribute;
use App\Models\Badge;
use App\Models\Bundle;
use App\Models\Category;
use App\Models\Coupon;
use App\Models\FeeRule;
use App\Models\LandingPage;
use App\Models\Popup;
use App\Models\Product;
use App\Models\Quote;
use App\Models\ShippingCity;
use App\Models\ShopOrder;
use App\Models\Warranty;
use App\Services\CheckoutService;
use App\Services\CommerceService;
use App\Services\OrderService;
use App\Services\PaymentService;
use App\Services\PriceVisibility;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Read-only data for the Next storefront (faw-shop), which no longer opens the database itself.
 * Only public fields leave this controller; private pages (quote link, order confirmation) are reached
 * through an unguessable token / order number and never list other customers' data.
 */
class ShopDataController extends Controller
{
    /** Order confirmation pages stay readable this long after the order (the number is the only key). */
    protected const ORDER_CONFIRMATION_DAYS = 30;

    /** Merchandising edited in Filament: categories, badges, warranties, attributes, packs, popups, shipping. */
    public function merch(CommerceService $commerce): JsonResponse
    {
        $show = PriceVisibility::showOnSite();
        $order = fn ($q) => $q->orderBy('sortOrder')->orderBy('id');

        // Only published categories: active, and every ancestor active too (a hidden parent hides its subtree).
        $allCategories = $order(Category::query())->get();
        $byId = $allCategories->keyBy('id');
        $published = function (Category $c) use ($byId): bool {
            for ($depth = 0, $node = $c; $node && $depth < 8; $depth++) {
                if (! $node->active) {
                    return false;
                }
                if (! $node->parentId) {
                    return true;
                }
                $node = $byId->get($node->parentId);
            }

            return false;
        };
        $categories = $allCategories->filter($published)->values()->map(fn (Category $c) => [
            'id' => (int) $c->id, 'parentId' => $c->parentId ? (int) $c->parentId : null, 'slug' => (string) $c->slug, 'label' => (string) $c->label,
            'short' => (string) ($c->short ?? ''), 'family' => (string) ($c->family ?? ''), 'description' => (string) ($c->description ?? ''),
            'image' => $c->image ?: null, 'seoTitle' => (string) ($c->seoTitle ?? ''), 'seoDescription' => (string) ($c->seoDescription ?? ''),
            'h1' => (string) ($c->h1 ?? ''), 'active' => (bool) $c->active, 'warrantyId' => $c->warrantyId ? (int) $c->warrantyId : null,
        ]);
        $badges = $order(Badge::where('active', true))->get()->map(fn (Badge $b) => ['id' => (int) $b->id, 'label' => (string) $b->label, 'tone' => (string) ($b->tone ?: 'neutral')]);
        $warranties = Warranty::where('active', true)->orderBy('id')->get()->map(fn (Warranty $w) => ['id' => (int) $w->id, 'name' => (string) $w->name, 'text' => (string) ($w->text ?? '')]);
        $attributes = $order(Attribute::where('active', true))->get()->map(fn (Attribute $a) => ['key' => (string) $a->key, 'label' => (string) $a->label, 'unit' => (string) ($a->unit ?? ''), 'showInSpecs' => (bool) $a->showInSpecs]);
        $bundleItems = fn (Bundle $b): array => is_array($b->items) ? $b->items : (json_decode((string) $b->items, true) ?: []);
        $activeBundles = $order(Bundle::where('active', true))->get();
        // A pack is only published when every product in it is published (otherwise it would expose a hidden product).
        $packProductIds = $activeBundles->flatMap(fn (Bundle $b) => array_map(fn ($it) => is_array($it) ? (string) ($it['id'] ?? '') : '', $bundleItems($b)))->filter()->unique()->values();
        $publishedProducts = $packProductIds->isEmpty() ? [] : array_flip(Product::where('active', true)->whereIn('id', $packProductIds->all())->pluck('id')->map(fn ($id) => (string) $id)->all());
        $bundles = $activeBundles->filter(function (Bundle $b) use ($bundleItems, $publishedProducts) {
            foreach ($bundleItems($b) as $it) {
                $id = is_array($it) ? (string) ($it['id'] ?? '') : '';
                if ($id !== '' && ! isset($publishedProducts[$id])) {
                    return false;
                }
            }

            return true;
        })->values()->map(function (Bundle $b) use ($show, $bundleItems) {
            $items = $bundleItems($b);

            return [
                'slug' => (string) $b->slug, 'title' => (string) $b->title, 'description' => (string) ($b->description ?? ''), 'image' => $b->image ?: null,
                'price' => $show ? (int) $b->price : null, 'orderable' => (int) $b->price > 0,
                'items' => array_values(array_filter(array_map(fn ($it) => is_array($it) ? ['id' => (string) ($it['id'] ?? ''), 'qty' => max(1, min(99, (int) ($it['qty'] ?? 1)))] : null, $items), fn ($it) => $it && $it['id'] !== '')),
            ];
        });
        $text = fn (?string $s) => $show ? (string) ($s ?? '') : (string) (PriceVisibility::sanitizeText($s) ?? '');
        $popups = Popup::where('active', true)->orderBy('id')->get()->filter(fn (Popup $p) => $commerce->live($p))->values()->map(fn (Popup $p) => [
            'id' => (int) $p->id, 'v' => (string) ($p->updatedAt?->getTimestampMs() ?? 0), 'kind' => in_array($p->kind, ['promo', 'newsletter', 'whatsapp'], true) ? $p->kind : 'promo',
            'title' => $text($p->title), 'body' => $text($p->body), 'ctaLabel' => $text($p->ctaLabel), 'ctaUrl' => preg_match('#^(/(?!/)|https://)#', (string) $p->ctaUrl) ? (string) $p->ctaUrl : '',
            'trigger' => in_array($p->trigger, ['delay', 'scroll', 'exit'], true) ? $p->trigger : 'delay', 'delaySeconds' => (int) $p->delaySeconds, 'scrollPercent' => (int) $p->scrollPercent,
            'paths' => array_values(array_filter(array_map('trim', explode(',', (string) $p->paths)), fn ($x) => str_starts_with($x, '/'))),
            'frequency' => in_array($p->frequency, ['once', 'session', 'days'], true) ? $p->frequency : 'session', 'frequencyDays' => (int) $p->frequencyDays,
        ]);
        $cities = $order(ShippingCity::where('active', true))->get()->map(fn (ShippingCity $c) => [
            'slug' => (string) $c->slug, 'name' => (string) $c->name, 'fee' => $show && $c->fee !== null ? (int) $c->fee : null, 'available' => (bool) $c->available, 'delayText' => (string) ($c->delayText ?? ''),
        ]);
        $rules = FeeRule::where('active', true)->orderBy('id')->get()->map(fn (FeeRule $r) => [
            'scope' => $r->scope === 'category' ? 'category' : 'product', 'target' => (string) $r->target, 'city' => (string) ($r->citySlug ?? ''),
            'mode' => $show && $r->mode !== 'devis' ? 'fixed' : 'devis', 'fee' => $show ? (int) $r->fee : null,
        ]);

        return response()->json([
            'showPrices' => $show, 'categories' => $categories, 'badges' => $badges, 'warranties' => $warranties, 'attributes' => $attributes,
            'bundles' => $bundles, 'popups' => $popups, 'shipping' => ['cities' => $cities, 'rules' => $rules],
        ])->header('Cache-Control', 'no-store');
    }

    /** Published landing pages (sitemap). */
    public function landings(): JsonResponse
    {
        return response()->json(LandingPage::where('published', true)->orderBy('id')->get()->map(fn (LandingPage $l) => [
            'slug' => (string) $l->slug, 'updatedAt' => $l->updatedAt?->toIso8601String(),
        ]))->header('Cache-Control', 'no-store');
    }

    public function landing(string $slug): JsonResponse
    {
        abort_unless(preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) && strlen($slug) <= 60, 404);
        $l = LandingPage::where('published', true)->where('slug', $slug)->firstOrFail();
        $blocks = is_array($l->blocks) ? $l->blocks : (json_decode((string) $l->blocks, true) ?: []);
        $show = PriceVisibility::showOnSite();

        return response()->json([
            'slug' => (string) $l->slug, 'title' => (string) $l->title,
            'seoTitle' => $show ? (string) ($l->seoTitle ?? '') : (string) (PriceVisibility::sanitizeText($l->seoTitle) ?? ''),
            'seoDescription' => $show ? (string) ($l->seoDescription ?? '') : (string) (PriceVisibility::sanitizeText($l->seoDescription) ?? ''),
            'blocks' => $show ? $blocks : $this->sanitize($blocks), 'updatedAt' => $l->updatedAt?->toIso8601String(),
        ])->header('Cache-Control', 'no-store');
    }

    /**
     * Order confirmation (/commande/confirmation/{number}). The number carries 128 random bits; legacy short
     * numbers are not served. Only what the customer just submitted is returned, and only for a limited time.
     */
    public function order(string $number, PaymentService $payments): JsonResponse
    {
        abort_unless(preg_match('/^FAW-\d{6}-[0-9A-F]{32}$/', $number), 404);
        $o = ShopOrder::where('number', $number)->first();
        abort_unless($o && $o->createdAt && $o->createdAt->gt(now()->subDays(self::ORDER_CONFIRMATION_DAYS)), 404);
        $items = DB::table('OrderItem')->where('orderId', $o->id)->orderBy('id')->get(['id', 'productId', 'title', 'quantity', 'unitPrice', 'lineTotal']);
        $total = (int) $o->total;

        return response()->json([
            'number' => (string) $o->number, 'customerName' => (string) $o->customerName, 'city' => (string) $o->city,
            'deliveryMode' => (string) $o->deliveryMode, 'deliveryFee' => (int) $o->deliveryFee, 'deliveryNote' => $o->deliveryNote ?: null,
            'paymentMethod' => (string) $o->paymentMethod, 'total' => $total,
            'items' => $items->map(fn ($i) => ['id' => (int) $i->id, 'productId' => (string) $i->productId, 'title' => (string) $i->title, 'quantity' => (int) $i->quantity, 'unitPrice' => (int) $i->unitPrice, 'lineTotal' => (int) $i->lineTotal])->values(),
            // Checkout details (site orders): what the customer just submitted, plus the payment state of this order only.
            'status' => (string) $o->status, 'paymentStatus' => $o->paymentStatus ?: null, 'subtotal' => (int) $o->subtotal,
            'couponCode' => $o->couponCode ?: null, 'couponDiscount' => (int) $o->couponDiscount, 'company' => $o->company ?: null,
            'taxRate' => CheckoutService::TAX_RATE, 'totalHt' => CheckoutService::ht($total), 'tva' => round($total - CheckoutService::ht($total), 2),
            'pickupAddress' => $o->deliveryMode === 'retrait' ? OrderService::pickupAddress() : null,
            'payment' => $payments->shopOrderState($o),
        ])->header('Cache-Control', 'private, no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }

    /**
     * Customer quote page (/devis/suivi|confirmation/{token}). Same token rules as StoreController::follow:
     * active link only. Prices are shown only once the team has validated the quote.
     */
    public function quote(string $token): JsonResponse
    {
        $q = Quote::findByRawToken($token);
        abort_unless($q !== null, 404);
        $ready = in_array($q->status, ['validé', 'envoyé'], true) && $q->pdfFile && $q->number;
        $lines = json_decode((string) $q->lines, true);
        $lines = array_values(array_filter(is_array($lines) ? $lines : [], 'is_array'));
        $ids = array_values(array_unique(array_map(fn ($l) => (string) ($l['id'] ?? ''), $lines)));

        return response()->json([
            'status' => (string) $q->status, 'ready' => (bool) $ready, 'number' => $ready ? (string) $q->number : null,
            'versionNumber' => $ready ? ($q->versionNumber ?: null) : null, 'clientName' => (string) $q->clientName,
            'createdAt' => $q->createdAt?->toIso8601String(), 'transport' => (string) ($q->transport ?? ''),
            'totalHt' => $ready ? (float) $q->totalHt : null, 'totalTtc' => $ready ? (float) $q->totalTtc : null,
            'lines' => array_map(fn ($l) => ['id' => (string) ($l['id'] ?? ''), 'title' => (string) ($l['title'] ?? ''), 'qty' => (int) ($l['qty'] ?? 0)]
                + ($ready ? ['unit' => (float) ($l['unit'] ?? 0), 'total' => (float) ($l['total'] ?? 0), 'tier' => (bool) ($l['tier'] ?? false)] : []), $lines),
            'warranties' => $this->warranties($ids),
        ])->header('Cache-Control', 'private, no-store')->header('X-Robots-Tag', 'noindex, nofollow');
    }

    /** Coupon check for the cart (the order total is always recomputed by StoreController::submit). */
    public function coupon(Request $r, CommerceService $commerce): JsonResponse
    {
        $v = $r->validate(['code' => ['required', 'string', 'max:40'], 'subtotal' => ['required', 'integer', 'min:0', 'max:100000000']]);
        if (! PriceVisibility::showOnSite()) {
            return response()->json(['ok' => false, 'message' => 'Code promo appliqué sur devis.']);
        }
        $code = substr(preg_replace('/[^A-Z0-9_-]/', '', strtoupper(trim($v['code']))), 0, 40);
        $c = $code !== '' ? Coupon::where('code', $code)->first() : null;
        if (! $c || ! $c->active || ! $commerce->live($c) || $c->value <= 0) {
            return response()->json(['ok' => false, 'message' => 'Code promo non valable']);
        }
        if ($c->usageLimit !== null && $c->usedCount >= $c->usageLimit) {
            return response()->json(['ok' => false, 'message' => 'Code promo épuisé']);
        }
        if ($v['subtotal'] < $c->minOrder) {
            return response()->json(['ok' => false, 'message' => 'Code promo valable à partir de '.number_format((int) $c->minOrder, 0, ',', ' ').' DH d\'achat']);
        }

        return response()->json(['ok' => true, 'coupon' => ['code' => (string) $c->code, 'kind' => $c->kind === 'percent' ? 'percent' : 'fixed', 'value' => (int) $c->value, 'minOrder' => (int) $c->minOrder]])
            ->header('Cache-Control', 'no-store');
    }

    /** Distinct warranties for the quoted products (product warranty, else its category's). */
    protected function warranties(array $ids): array
    {
        $ids = array_slice(array_filter($ids), 0, 100);
        if (! $ids) {
            return [];
        }
        $warranties = Warranty::where('active', true)->get()->keyBy('id');
        if ($warranties->isEmpty()) {
            return [];
        }
        $byLabel = Category::query()->get(['label', 'warrantyId'])->keyBy('label');
        $out = [];
        foreach (Product::whereIn('id', $ids)->get(['id', 'warrantyId', 'category']) as $p) {
            $wid = $p->warrantyId ?: $byLabel->get($p->category)?->warrantyId;
            $w = $wid ? $warranties->get((int) $wid) : null;
            if ($w && trim((string) $w->text) !== '') {
                $out[$w->name."\n".$w->text] = ['name' => (string) $w->name, 'text' => trim((string) $w->text)];
            }
        }

        return array_values($out);
    }

    /** @param  array<int|string, mixed>  $blocks */
    protected function sanitize(array $blocks): array
    {
        foreach ($blocks as $k => $v) {
            if (is_string($v)) {
                $blocks[$k] = PriceVisibility::sanitizeText($v);
            } elseif (is_array($v)) {
                $blocks[$k] = $this->sanitize($v);
            }
        }

        return $blocks;
    }
}
