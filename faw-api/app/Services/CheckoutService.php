<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\AuditEntry;
use App\Models\Bundle;
use App\Models\Customer;
use App\Models\Product;
use App\Models\ShippingCity;
use App\Models\ShopOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Online checkout (« Achat en ligne » products). Every amount is recomputed here from the database: product
 * prices and promotions, packs, shipping (ShippingCity / FeeRule), coupon. Client totals are never read.
 * Prices are TTC (TVA 20 %); HT is derived for display and e-mails.
 */
class CheckoutService
{
    public const TAX_RATE = 20;

    public function __construct(private CommerceService $commerce, private PaymentService $payments, private TransactionalMail $mail) {}

    public static function ht(int|float $ttc): float
    {
        return round($ttc / (1 + self::TAX_RATE / 100), 2);
    }

    public static function money(int|float $amount): string
    {
        return number_format((float) $amount, 2, ',', ' ').' MAD';
    }

    /**
     * Items that cannot be bought online (they go to a quote request instead).
     *
     * @param  list<array{id: string, qty: int}>  $items
     * @return list<array{id: string, reason: string, max?: int}>  reason: quote_only | over_max | unavailable
     */
    public function blockers(array $items): array
    {
        $out = [];
        $show = PriceVisibility::showOnSite();
        foreach ($items as $it) {
            $id = (string) $it['id'];
            $qty = (int) $it['qty'];
            if (str_starts_with($id, 'pack:')) {
                $b = Bundle::where('slug', substr($id, 5))->where('active', true)->first();
                if (! $show || ! $b || (int) $b->price <= 0) {
                    $out[] = ['id' => $id, 'reason' => 'quote_only'];
                }

                continue;
            }
            $p = Product::find($id);
            if (! $p || ! $p->active) {
                continue; // CommerceService::price() refuses unknown products
            }
            if (PriceVisibility::quoteOnly($p)) {
                $out[] = ['id' => $id, 'reason' => 'quote_only'];
            } elseif (! PriceVisibility::orderable($p, (int) $p->price)) {
                $out[] = ['id' => $id, 'reason' => 'unavailable'];
            } elseif ($p->maxOnlineQty !== null && $qty > (int) $p->maxOnlineQty) {
                $out[] = ['id' => $id, 'reason' => 'over_max', 'max' => (int) $p->maxOnlineQty];
            }
        }

        return $out;
    }

    /**
     * Cart / checkout summary computed by the server (no side effect: the coupon is checked, not consumed).
     *
     * @param  array{items: list<array{id: string, qty: int}>, deliveryMode?: ?string, pickup?: bool, coupon?: ?string, paymentMethod?: ?string}  $v
     */
    public function preview(array $v): array
    {
        $items = $v['items'];
        $priced = $this->commerce->price($items);
        $blockers = $this->blockers($items);
        $titles = $this->titles($items);
        if (! PriceVisibility::showOnSite()) {
            return ['pricesHidden' => true, 'quoteRequired' => true, 'blockers' => $blockers,
                'items' => array_map(fn ($it) => ['id' => (string) $it['id'], 'title' => $titles[(string) $it['id']] ?? (string) $it['id'], 'qty' => (int) $it['qty']], $items)];
        }
        $mode = $this->commerce->resolveMode($priced['lines'], $v['deliveryMode'] ?? null, (bool) ($v['pickup'] ?? false));
        $ship = $this->commerce->shipping($priced['lines'], $mode);
        $subtotal = (int) $priced['total'];
        $discount = 0;
        $coupon = null;
        $couponError = null;
        if (! empty($v['coupon'])) {
            try {
                $c = $this->commerce->coupon((string) $v['coupon'], $subtotal);
                $discount = (int) $c['discount'];
                $coupon = $c['code'];
            } catch (ValidationException $e) {
                $couponError = collect($e->errors())->flatten()->first();
            }
        }
        $total = max(0, $subtotal - $discount) + (int) $ship['fee'];
        $quoteOnlyIds = array_column($blockers, 'id');
        $rows = [];
        $units = $this->unitPrices($items, $priced['lines']);
        foreach ($items as $it) {
            $id = (string) $it['id'];
            $unit = $units[$id] ?? 0;
            $qty = (int) $it['qty'];
            $blocker = collect($blockers)->firstWhere('id', $id);
            $rows[] = ['id' => $id, 'title' => $titles[$id] ?? $id, 'qty' => $qty,
                'unitTtc' => $blocker && $blocker['reason'] === 'quote_only' ? null : $unit,
                'unitHt' => $blocker && $blocker['reason'] === 'quote_only' ? null : self::ht($unit),
                'totalTtc' => $blocker && $blocker['reason'] === 'quote_only' ? null : $unit * $qty,
                'totalHt' => $blocker && $blocker['reason'] === 'quote_only' ? null : self::ht($unit * $qty),
                'blocker' => $blocker['reason'] ?? null, 'maxOnlineQty' => $blocker['max'] ?? null];
        }
        $anyQuoteOnly = $quoteOnlyIds !== [];

        return [
            'pricesHidden' => false, 'currency' => 'MAD', 'taxRate' => self::TAX_RATE,
            'items' => $rows, 'blockers' => $blockers, 'quoteRequired' => $anyQuoteOnly,
            // Amounts are only meaningful for a fully buyable cart; a quote-only line hides them.
            'subtotalTtc' => $anyQuoteOnly ? null : $subtotal, 'subtotalHt' => $anyQuoteOnly ? null : self::ht($subtotal),
            'discount' => $anyQuoteOnly ? null : $discount, 'coupon' => $coupon, 'couponError' => $couponError,
            'deliveryMode' => $mode, 'deliveryModes' => $this->commerce->deliveryModes($priced['lines'])['allowed'],
            'shipping' => ['fee' => $anyQuoteOnly ? null : (int) $ship['fee'], 'label' => $ship['label'], 'toConfirm' => str_contains($ship['label'], 'à confirmer') || str_contains($ship['label'], 'sur devis') || $mode === 'transporteur'],
            'totalTtc' => $anyQuoteOnly ? null : $total, 'totalHt' => $anyQuoteOnly ? null : self::ht($total), 'tva' => $anyQuoteOnly ? null : round($total - self::ht($total), 2),
            'payments' => $anyQuoteOnly ? [] : CheckoutSettings::methods($total, $mode),
        ];
    }

    /**
     * Create a site order. Same path as before (Order + OrderItem + LeadEvent history + cart recovery + event),
     * plus the payment row, an audit entry and the customer / team e-mails.
     *
     * @param  array<string, mixed>  $v  validated by StoreController::submit
     * @return array{number: string, paymentMethod: string}
     */
    public function place(array $v): array
    {
        if (! PriceVisibility::showOnSite()) {
            throw ValidationException::withMessages(['items' => 'Les prix ne sont pas affichés : envoyez une demande de devis.']);
        }
        if ($blockers = $this->blockers($v['items'])) {
            $b = $blockers[0];
            throw ValidationException::withMessages(['items' => match ($b['reason']) {
                'over_max' => "Quantité supérieure à {$b['max']} pour {$b['id']} : transformez votre panier en demande de devis.",
                'unavailable' => "{$b['id']} n’est pas disponible à la commande en ligne : demandez un devis.",
                default => "{$b['id']} est vendu sur devis : transformez votre panier en demande de devis.",
            }]);
        }
        $priced = $this->commerce->price($v['items'], $v);
        $pickup = (bool) ($v['pickup'] ?? false);
        $mode = $this->commerce->resolveMode($priced['lines'], $v['deliveryMode'] ?? null, $pickup);
        $pickup = $mode === 'retrait';
        if (! $pickup && mb_strlen(trim((string) ($v['address'] ?? ''))) < 5) {
            throw ValidationException::withMessages(['address' => 'Adresse de livraison requise.']);
        }
        $method = (string) $v['paymentMethod'];
        $city = ShippingCity::where('slug', $mode)->first();
        $cityName = $city?->name ?? (string) $v['city'];

        $result = DB::transaction(function () use ($v, $priced, $mode, $pickup, $method, $cityName) {
            $phone = self::normalizePhone((string) $v['phone']);
            $client = Customer::updateOrCreate(['phone' => $phone], ['name' => $v['name'], 'email' => $v['email'] ?? null, 'city' => $cityName, 'company' => $v['company'] ?? null, 'ice' => $v['ice'] ?? null, 'type' => $v['clientType'] ?? 'particulier', 'source' => 'site', 'lastActivityAt' => now()]);
            $shipping = $this->commerce->shipping($priced['lines'], $mode);
            $coupon = ! empty($v['coupon']) ? $this->commerce->coupon((string) $v['coupon'], (int) $priced['total'], true) : null;
            $total = max(0, (int) $priced['total'] - (int) ($coupon['discount'] ?? 0)) + (int) $shipping['fee'];
            $available = collect(CheckoutSettings::methods($total, $mode))->firstWhere('key', $method);
            if (! $available || ! $available['available']) {
                throw ValidationException::withMessages(['paymentMethod' => match ($available['reason'] ?? null) {
                    'cod_max' => 'Paiement à la livraison non disponible au-delà de '.self::money((int) CheckoutSettings::codMaxAmount()).' TTC.',
                    'cod_city' => 'Paiement à la livraison non disponible pour cette ville.',
                    default => 'Mode de paiement non disponible.',
                }]);
            }
            $number = 'FAW-'.now()->format('ymd').'-'.strtoupper(bin2hex(random_bytes(16)));
            $o = ShopOrder::create(['number' => $number, 'contactId' => $client->id, 'customerName' => $v['name'], 'phone' => $phone, 'email' => $v['email'] ?? null, 'city' => $cityName,
                'citySlug' => ShippingCity::where('slug', $mode)->exists() ? $mode : null, 'address' => $pickup ? '' : trim((string) ($v['address'] ?? '')), 'company' => $v['company'] ?? null, 'ice' => $v['ice'] ?? null,
                'clientType' => $v['clientType'] ?? 'particulier', 'deliveryMode' => $mode, 'deliveryFee' => (int) $shipping['fee'], 'deliveryNote' => $shipping['label'],
                'paymentMethod' => $method, 'paymentStatus' => $method === 'reception' ? 'a_la_livraison' : 'en_attente', 'cgvAccepted' => true,
                'notes' => $v['note'] ?? null, 'subtotal' => (int) $priced['total'], 'total' => $total, 'couponCode' => $coupon['code'] ?? null, 'couponDiscount' => (int) ($coupon['discount'] ?? 0),
                'cartId' => $v['cartId'] ?? null, 'locale' => $v['locale'] ?? 'fr', 'utmSource' => $v['attribution']['utmSource'] ?? null, 'utmMedium' => $v['attribution']['utmMedium'] ?? null, 'utmCampaign' => $v['attribution']['utmCampaign'] ?? null,
                'quoteRefusal' => $priced['reasons'] ? implode(' ; ', $priced['reasons']) : null]);
            foreach ($priced['lines'] as $l) {
                DB::table('OrderItem')->insert(['orderId' => $o->id, 'productId' => $l['id'], 'title' => $l['title'], 'category' => $l['category'], 'unitPrice' => $l['unit'], 'quantity' => $l['qty'], 'lineTotal' => $l['total']]);
            }
            Activity::create(['orderId' => $o->id, 'toStatus' => 'nouveau', 'createdAt' => now()]);
            if (! empty($v['cartId'])) {
                DB::table('Cart')->where('id', $v['cartId'])->update(['status' => 'récupéré', 'orderNumber' => $number, 'updatedAt' => now()->getTimestampMs()]);
            }
            DB::table('Event')->insert(['type' => 'order', 'path' => '/commande', 'source' => $v['attribution']['utmSource'] ?? null, 'medium' => $v['attribution']['utmMedium'] ?? null, 'campaign' => $v['attribution']['utmCampaign'] ?? null, 'value' => $total]);
            $payment = $this->payments->createShopPayment($o, $method);
            AuditEntry::create(['actor' => 'site', 'action' => 'created', 'entity' => 'Order', 'entityId' => (string) $o->id, 'summary' => 'Commande site '.substr($number, 0, 17).' — '.ShopOrder::paymentLabel($method).' — '.self::money($total).' TTC', 'at' => now()]);

            return ['order' => $o, 'payment' => $payment];
        });
        $this->notify($result['order'], $result['payment']->reference);

        return ['number' => (string) $result['order']->number, 'paymentMethod' => $method];
    }

    public static function normalizePhone(string $phone): string
    {
        $phone = (string) preg_replace('/[\s.()\-]/', '', $phone);
        if (str_starts_with($phone, '0')) {
            $phone = str_starts_with($phone, '00212') ? '+'.substr($phone, 2) : '+212'.substr($phone, 1);
        }

        return $phone;
    }

    /** Customer + team e-mails (plain text, no link: TransactionalMail policy). Never blocks the order. */
    public function notify(ShopOrder $o, string $paymentRef): void
    {
        $short = substr((string) $o->number, 0, 17);
        $items = DB::table('OrderItem')->where('orderId', $o->id)->orderBy('id')->get();
        $lines = $items->map(fn ($i) => '- '.$i->quantity.' × '.$i->title.' ('.$i->productId.') : '.self::money((int) $i->lineTotal).' TTC')->implode("\n");
        $total = (int) $o->total;
        $totals = "Sous-total : ".self::money((int) $o->subtotal)." TTC\n"
            .((int) $o->couponDiscount > 0 ? 'Code promo '.$o->couponCode.' : −'.self::money((int) $o->couponDiscount)."\n" : '')
            .'Livraison : '.((int) $o->deliveryFee > 0 ? self::money((int) $o->deliveryFee).' TTC' : ($o->deliveryMode === 'retrait' ? 'retrait gratuit au dépôt' : 'à confirmer'))."\n"
            .'Total HT : '.self::money(self::ht($total))."\n"
            .'TVA '.self::TAX_RATE.' % : '.self::money($total - self::ht($total))."\n"
            .'Total TTC : '.self::money($total);
        $method = (string) $o->paymentMethod;
        $howToPay = match ($method) {
            'virement' => $this->bankText($paymentRef, $total),
            'reception' => "Paiement à la livraison ou au retrait : vous réglez à la réception de la marchandise. Notre équipe vous appelle pour confirmer la commande et le rendez-vous.",
            'carte' => "Paiement par carte bancaire (CMI). Si le paiement n’a pas abouti, vous pouvez le reprendre depuis la page de confirmation de votre commande.",
            default => '',
        };
        if ($o->email) {
            if ($o->locale === 'ar') {
                $payLabelAr = match ($method) {
                    'virement' => 'تحويل بنكي',
                    'reception' => 'عند الاستلام / في المستودع',
                    'carte' => 'بطاقة بنكية (CMI)',
                    default => $method,
                };
                $howToPayAr = match ($method) {
                    'virement' => $this->bankTextAr($paymentRef, $total),
                    'reception' => "الأداء عند التسليم أو الاستلام: يتم الأداء عند استلام البضاعة. سيتصل بكم فريقنا لتأكيد الطلب وتحديد الموعد.",
                    'carte' => "الأداء بالبطاقة البنكية (CMI). إذا لم يكتمل الأداء، يمكنك استئنافه من صفحة تأكيد طلبك.",
                    default => '',
                };
                $totalsAr = "المجموع الفرعي : ".self::money((int) $o->subtotal)." شامل الضريبة\n"
                    .((int) $o->couponDiscount > 0 ? 'رمز التخفيض '.$o->couponCode.' : −'.self::money((int) $o->couponDiscount)."\n" : '')
                    .'التوصيل : '.((int) $o->deliveryFee > 0 ? self::money((int) $o->deliveryFee).' شامل الضريبة' : ($o->deliveryMode === 'retrait' ? 'استلام مجاني من المستودع' : 'يحدد لاحقاً'))."\n"
                    .'المجموع دون ضريبة : '.self::money(self::ht($total))."\n"
                    .'الضريبة على القيمة المضافة '.self::TAX_RATE.' % : '.self::money($total - self::ht($total))."\n"
                    .'المجموع شامل الضريبة : '.self::money($total);

                $linesAr = $items->map(fn ($i) => '- '.$i->quantity.' × '.$i->title.' ('.$i->productId.') : '.self::money((int) $i->lineTotal).' شامل الضريبة')->implode("\n");

                $this->mail->send((string) $o->email, 'FAW Aluminium — تم استلام الطلب '.$short,
                    "مرحباً {$o->customerName}،\n\nلقد تم تسجيل طلبكم رقم {$short} بنجاح.\n\n{$linesAr}\n\n{$totalsAr}\n\nطريقة الأداء : {$payLabelAr}.\n{$howToPayAr}\n\nتوريد فقط، التركيب غير مشمول. لأي استفسار، يرجى الرد على هذه الرسالة.\n\nFAW Aluminium — الدار البيضاء",
                    'faw-shop-order-customer-'.$o->id);
            } else {
                $this->mail->send((string) $o->email, 'FAW Aluminium — commande '.$short.' reçue',
                    "Bonjour {$o->customerName},\n\nNous avons bien reçu votre commande {$short}.\n\n{$lines}\n\n{$totals}\n\nPaiement : ".ShopOrder::paymentLabel($method).".\n{$howToPay}\n\n".(string) $o->deliveryNote."\n\nFourniture seule, pose non comprise. Pour toute question, répondez simplement à cet e-mail.\n\nFAW Aluminium — Casablanca",
                    'faw-shop-order-customer-'.$o->id);
            }
        }
        $team = TransactionalMail::teamAddress();
        if ($team) {
            $who = $o->customerName.($o->company ? ' — '.$o->company.($o->ice ? ' (ICE '.$o->ice.')' : '') : '');
            $this->mail->send($team, 'FAW — nouvelle commande site '.$short.' ('.self::money($total).')',
                "Nouvelle commande sur le site : {$short}\nClient : {$who}\nTéléphone : {$o->phone}\nE-mail : ".($o->email ?: '—')."\nVille : {$o->city}\nAdresse : ".($o->address ?: 'retrait au dépôt')."\n\n{$lines}\n\n{$totals}\n\nPaiement : ".ShopOrder::paymentLabel($method)." (réf. {$paymentRef})\n".($o->notes ? "Note client : {$o->notes}\n" : '')."\nÀ traiter dans le back-office FAW (Commandes / demandes).",
                'faw-shop-order-team-'.$o->id);
        }
    }

    private function bankText(string $ref, int $total): string
    {
        $b = CheckoutSettings::bank();
        $rows = array_filter(['Titulaire' => $b['holder'], 'Banque' => $b['bankName'], 'Agence' => $b['branch'], 'RIB' => $b['rib'], 'IBAN' => $b['iban'], 'SWIFT' => $b['swift']]);
        $details = $rows ? implode("\n", array_map(fn ($k, $v) => $k.' : '.$v, array_keys($rows), $rows)) : 'Les coordonnées bancaires vous sont communiquées par l’équipe FAW.';

        return "Virement bancaire de ".self::money($total)." :\n{$details}\nIndiquez la référence {$ref} dans le libellé du virement, puis déposez le justificatif depuis la page de confirmation de votre commande (ou répondez à cet e-mail avec le justificatif).";
    }

    private function bankTextAr(string $ref, int $total): string
    {
        $b = CheckoutSettings::bank();
        $rows = array_filter(['صاحب الحساب' => $b['holder'], 'البنك' => $b['bankName'], 'الوكالة' => $b['branch'], 'RIB' => $b['rib'], 'IBAN' => $b['iban'], 'SWIFT' => $b['swift']]);
        $details = $rows ? implode("\n", array_map(fn ($k, $v) => $k.' : '.$v, array_keys($rows), $rows)) : 'بيانات الحساب البنكي سيتم إرسالها من طرف فريق FAW.';

        return "تحويل بنكي بمبلغ ".self::money($total)." :\n{$details}\nيرجى كتابة المرجع {$ref} في بيان التحويل، ثم إيداع وصل التحويل في صفحة تأكيد طلبكم (أو الرد على هذه الرسالة مع إرفاق الوصل).";
    }

    /** @return array<string, string> */
    private function titles(array $items): array
    {
        $out = [];
        foreach ($items as $it) {
            $id = (string) $it['id'];
            $out[$id] = str_starts_with($id, 'pack:')
                ? (string) (Bundle::where('slug', substr($id, 5))->value('title') ?? $id)
                : (string) (Product::whereKey($id)->value('title') ?? $id);
        }

        return $out;
    }

    /** Unit TTC per requested item (product: price after promotion / quantity tier; pack: pack price). */
    private function unitPrices(array $items, array $lines): array
    {
        $units = [];
        $productLines = [];
        foreach ($lines as $l) {
            $productLines[$l['id']] ??= $l['unit'];
        }
        foreach ($items as $it) {
            $id = (string) $it['id'];
            $units[$id] = str_starts_with($id, 'pack:') ? (int) (Bundle::where('slug', substr($id, 5))->value('price') ?? 0) : (int) ($productLines[$id] ?? 0);
        }

        return $units;
    }
}
