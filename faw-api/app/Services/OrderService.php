<?php

namespace App\Services;

use App\Models\CustomerOrder;
use App\Models\OrderStatusHistory;
use App\Models\Quote;
use App\Models\QuoteDecision;
use App\Models\QuoteVersion;
use App\Models\User;
use App\Support\OrderStatus;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderService
{
    /** Called inside the acceptance transaction. Idempotent: one order per quote (unique quote_id). */
    public function createFromAcceptance(Quote $q, QuoteVersion $v, QuoteDecision $d): CustomerOrder
    {
        return DB::transaction(function () use ($q, $v, $d) {
            if ($existing = CustomerOrder::where('quote_id', $q->id)->first()) {
                return $existing;
            }
            $year = (int) now('Africa/Casablanca')->format('Y');
            DB::table('order_sequences')->insertOrIgnore(['year' => $year, 'last' => 0]);
            DB::table('order_sequences')->where('year', $year)->increment('last');
            $seq = (int) DB::table('order_sequences')->where('year', $year)->value('last');
            $order = CustomerOrder::create([
                'reference' => sprintf('FAW-CMD-%d-%04d', $year, $seq),
                'quote_id' => $q->id, 'quote_version_id' => $v->id, 'quote_decision_id' => $d->id, 'version_number' => $v->number,
                'client_name' => (string) $q->clientName, 'phone' => $q->phone, 'email' => $q->email, 'city' => $q->city,
                'lines' => $v->lines, 'totals' => $v->totals, 'total_ttc' => $v->total_ttc, 'currency' => $v->currency,
                'tax_rate' => (int) ($v->totals['tax_rate'] ?? config('faw.quote_tax_rate', 20)), 'delivery' => $v->delivery,
                'fulfilment' => ($v->delivery['mode'] ?? '') === 'retrait' ? 'retrait' : 'livraison',
                'status' => OrderStatus::AwaitingPayment, 'status_changed_at' => now(),
            ]);
            OrderStatusHistory::create(['customer_order_id' => $order->id, 'from_status' => null, 'to_status' => OrderStatus::AwaitingPayment->value, 'note' => 'Commande créée à l’acceptation du devis '.$v->number.' par le client.', 'source' => 'system']);
            $this->created($order);

            return $order;
        });
    }

    /** Default schedule: one full payment by bank transfer (FAW can change it in the back-office). */
    protected function created(CustomerOrder $order): void
    {
        app(PaymentService::class)->createDefaultSchedule($order);
    }

    public function transition(CustomerOrder $order, OrderStatus $to, ?User $user, ?string $note = null, string $source = 'admin'): CustomerOrder
    {
        if ($source === 'admin' && ! in_array($to, OrderStatus::allowedFor($user), true)) {
            throw ValidationException::withMessages(['status' => 'Statut non autorisé pour votre rôle.']);
        }

        return DB::transaction(function () use ($order, $to, $user, $note, $source) {
            $fresh = CustomerOrder::findOrFail($order->id);
            $from = $fresh->status;
            if ($from === $to) {
                return $fresh;
            }
            if ($from->isFinal() && ! $user?->canDo('*')) {
                throw ValidationException::withMessages(['status' => 'Commande '.$from->label().' : statut final.']);
            }
            $fresh->update(['status' => $to, 'status_changed_at' => now()]);
            OrderStatusHistory::create(['customer_order_id' => $fresh->id, 'from_status' => $from->value, 'to_status' => $to->value, 'note' => $note ? mb_substr($note, 0, 500) : null, 'source' => $source, 'user_id' => $user?->id]);

            return $fresh;
        });
    }

    public function updateFulfilment(CustomerOrder $order, string $mode, ?string $address, ?string $note, ?User $user): CustomerOrder
    {
        if (! $user || ! ($user->canDo('manage.customer_orders') || $user->canDo('write.shipping'))) {
            throw ValidationException::withMessages(['fulfilment' => 'Action réservée à la logistique ou au responsable commercial.']);
        }
        if (! in_array($mode, ['retrait', 'livraison'], true)) {
            throw ValidationException::withMessages(['fulfilment' => 'Retrait ou livraison.']);
        }
        $order->update(['fulfilment' => $mode, 'delivery_address' => $mode === 'livraison' ? (trim((string) $address) ?: null) : null, 'delivery_note' => $note ? mb_substr(trim($note), 0, 500) : null]);

        return $order->fresh();
    }

    /** Pickup address shown to customers: configured value only (empty until FAW provides it). */
    public static function pickupAddress(): ?string
    {
        $a = trim((string) config('faw.pickup_address'));

        return $a !== '' ? $a : null;
    }

    public function portalState(Quote $q): ?array
    {
        $o = CustomerOrder::where('quote_id', $q->id)->first();
        if (! $o) {
            return null;
        }

        return [
            'reference' => $o->reference, 'status' => $o->status->value, 'versionNumber' => $o->version_number,
            'totalTtc' => $o->total_ttc, 'currency' => $o->currency, 'fulfilment' => $o->fulfilment,
            'pickupAddress' => $o->fulfilment === 'retrait' ? self::pickupAddress() : null,
            'deliveryCity' => $o->delivery['city'] ?? $o->city, 'deliveryLabel' => $o->delivery['label'] ?? null,
            'createdAt' => $o->created_at?->toIso8601String(),
            'payment' => app(PaymentService::class)->portalState($o),
            'history' => $o->history()->get()->map(fn ($h) => ['status' => $h->to_status, 'at' => $h->created_at?->toIso8601String()])->all(),
        ];
    }
}
