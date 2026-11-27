<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\CustomerOrder;
use App\Models\Payment;
use App\Models\PaymentTransaction;
use App\Models\ShopOrder;
use App\Models\User;
use App\Payments\BankTransferProvider;
use App\Payments\PaymentProviders;
use App\Support\OrderStatus;
use App\Support\PaymentStatus;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Payment schedule + bank-transfer verification. Amounts are typed by FAW and must add up exactly to the
 * order total: no percentage, no fee, no interest. Quote orders (CustomerOrder) and site orders (ShopOrder,
 * one payment of the full total, method chosen at checkout) share the same payment rows and audit trail.
 */
class PaymentService
{
    public const PROOF_MIMES = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];

    public const PROOF_MAX_BYTES = 5 * 1024 * 1024;

    public const MAX_PARTS = 12;

    public function __construct(private PaymentProviders $providers, private TransactionalMail $mail) {}

    public static function canSchedule(?User $u): bool
    {
        return (bool) ($u?->canDo('manage.customer_orders') || $u?->canDo('write.finance'));
    }

    public static function canValidate(?User $u): bool
    {
        return (bool) $u?->canDo('write.finance'); // finance + super admin
    }

    /** Default on order creation: one full payment by bank transfer. */
    public function createDefaultSchedule(CustomerOrder $order): void
    {
        $this->writeSchedule($order, [['label' => 'Paiement intégral', 'amount' => $order->total_ttc]], null, 'system', null);
    }

    /** Site checkout: one payment of the full total with the chosen method (virement | reception | carte). */
    public function createShopPayment(ShopOrder $order, string $method): Payment
    {
        $provider = CheckoutSettings::PROVIDERS[$method] ?? 'bank_transfer';
        $day = substr((string) $order->number, 4, 6);
        // Short public reference (bank transfer label, CMI order id): never the full private order number.
        $reference = 'FAW-'.$day.'-'.substr((string) $order->number, 11, 6).'-P1';
        if (Payment::where('reference', $reference)->exists()) {
            $reference = 'FAW-'.$day.'-'.strtoupper(bin2hex(random_bytes(4))).'-P1';
        }
        $pay = Payment::create(['shop_order_id' => $order->id, 'position' => 1, 'label' => 'Paiement intégral', 'amount' => (int) $order->total, 'currency' => 'MAD',
            'provider' => $provider, 'reference' => $reference, 'status' => PaymentStatus::Awaiting]);
        $this->log($pay, 'created', null, PaymentStatus::Awaiting, null, 'system', 'Commande passée sur le site ('.ShopOrder::paymentLabel($method).').');

        return $pay;
    }

    /** CMI notification refused / failed: the payment stays open (the customer may retry), the order shows the failure. */
    public function markFailed(Payment $payment, string $note, ?string $ip = null, array $meta = []): void
    {
        DB::transaction(function () use ($payment, $note, $ip, $meta) {
            $this->log($payment, 'failed', $payment->status, $payment->status, null, 'webhook', $note, $ip, $meta ?: null);
            if ($payment->shop_order_id && $payment->status !== PaymentStatus::Confirmed) {
                ShopOrder::whereKey($payment->shop_order_id)->update(['paymentStatus' => 'echec']);
            }
        });
    }

    /**
     * @param  list<array{label?: string, amount: int|string}>  $parts
     */
    public function setSchedule(CustomerOrder $order, array $parts, ?User $user, ?string $note = null): void
    {
        if (! self::canSchedule($user)) {
            throw ValidationException::withMessages(['schedule' => 'Échéancier réservé au responsable commercial, à la finance ou au super admin.']);
        }
        $clean = [];
        foreach (array_values($parts) as $i => $p) {
            $raw = is_int($p['amount'] ?? null) ? (string) $p['amount'] : trim((string) ($p['amount'] ?? ''));
            if (! preg_match('/^\d{1,9}$/', $raw) || (int) $raw <= 0) {
                throw ValidationException::withMessages(['schedule' => 'Montant n° '.($i + 1).' invalide (entier en DH, supérieur à 0).']);
            }
            $label = trim((string) ($p['label'] ?? '')) ?: 'Échéance '.($i + 1);
            $clean[] = ['label' => mb_substr($label, 0, 120), 'amount' => (int) $raw];
        }
        if ($clean === [] || count($clean) > self::MAX_PARTS) {
            throw ValidationException::withMessages(['schedule' => 'Entre 1 et '.self::MAX_PARTS.' échéances.']);
        }
        $sum = array_sum(array_column($clean, 'amount'));
        if ($sum !== (int) $order->total_ttc) {
            throw ValidationException::withMessages(['schedule' => "La somme des échéances ({$sum} DH) doit être égale au total de la commande ({$order->total_ttc} DH) : ni frais ni intérêts."]);
        }
        $this->writeSchedule($order, $clean, $user, 'admin', $note);
    }

    private function writeSchedule(CustomerOrder $order, array $parts, ?User $user, string $source, ?string $note): void
    {
        DB::transaction(function () use ($order, $parts, $user, $source, $note) {
            $order = CustomerOrder::findOrFail($order->id);
            if ($order->status->isFinal()) {
                throw ValidationException::withMessages(['schedule' => 'Commande '.$order->status->label().' : échéancier verrouillé.']);
            }
            $live = Payment::where('customer_order_id', $order->id)->whereIn('status', [PaymentStatus::Confirmed->value, PaymentStatus::PendingVerification->value])->exists();
            if ($live) {
                throw ValidationException::withMessages(['schedule' => 'Échéancier verrouillé : un paiement est déjà confirmé ou en vérification.']);
            }
            foreach (Payment::where('customer_order_id', $order->id)->whereIn('status', [PaymentStatus::Awaiting->value, PaymentStatus::Rejected->value])->get() as $old) {
                $this->move($old, PaymentStatus::Cancelled, 'cancelled', $user, $source, 'Remplacé par un nouvel échéancier.');
            }
            $n = Payment::where('customer_order_id', $order->id)->count();
            foreach ($parts as $i => $p) {
                $n++;
                $pay = Payment::create(['customer_order_id' => $order->id, 'position' => $i + 1, 'label' => $p['label'], 'amount' => $p['amount'], 'currency' => $order->currency ?: 'MAD',
                    'provider' => 'bank_transfer', 'reference' => $order->reference.'-P'.$n, 'status' => PaymentStatus::Awaiting]);
                $this->log($pay, 'created', null, PaymentStatus::Awaiting, $user, $source, $note);
            }
        });
    }

    /** @return list<Payment> active (non-cancelled) payments, schedule order */
    public function schedule(CustomerOrder $order): array
    {
        return Payment::where('customer_order_id', $order->id)->where('status', '!=', PaymentStatus::Cancelled->value)->orderBy('position')->orderBy('id')->get()->all();
    }

    /** Customer upload from the private link. Returns portal-style result codes. */
    public function uploadProof(Payment $payment, UploadedFile $file, ?string $ip): array
    {
        if (! in_array($payment->status, [PaymentStatus::Awaiting, PaymentStatus::Rejected], true) || ! $this->providers->get($payment->provider)?->acceptsProof()) {
            return ['ok' => false, 'code' => 'proof_not_allowed'];
        }
        if (! $file->isValid() || $file->getSize() > self::PROOF_MAX_BYTES || $file->getSize() < 1) {
            return ['ok' => false, 'code' => 'proof_too_large'];
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath()) ?: '';
        $ext = self::PROOF_MIMES[$mime] ?? null;
        if (! $ext) {
            return ['ok' => false, 'code' => 'proof_bad_type'];
        }
        $path = 'payment-proofs/'.$payment->customer_order_id.'/'.$payment->id.'-'.Str::random(24).'.'.$ext;
        Storage::disk('local')->put($path, file_get_contents($file->getRealPath()));
        DB::transaction(function () use ($payment, $path, $mime, $file, $ip) {
            $payment->forceFill(['proof_path' => $path, 'proof_mime' => $mime, 'proof_size' => $file->getSize(), 'proof_uploaded_at' => now()])->save();
            $this->move($payment, PaymentStatus::PendingVerification, 'proof_uploaded', null, 'customer', 'Justificatif de virement déposé par le client.', $ip, ['mime' => $mime, 'size' => $file->getSize()]);
        });
        $details = "Justificatif de virement reçu pour {$payment->reference} ({$payment->amount} {$payment->currency}). À vérifier par la finance.";
        $key = 'proof-'.$payment->id.'-'.$payment->proof_uploaded_at?->timestamp;
        if ($payment->shop_order_id) {
            ShopOrder::whereKey($payment->shop_order_id)->update(['paymentStatus' => 'en_verification']);
            $this->notifyTeamShop($payment->shopOrder()->firstOrFail(), $details, $key);
        } else {
            $this->notifyTeam($payment->order, $details, $key);
        }

        return ['ok' => true, 'code' => 'proof_saved'];
    }

    public function confirm(Payment $payment, ?User $user, ?string $note = null, string $source = 'admin', ?string $transactionId = null): Payment
    {
        if ($source === 'admin' && ! self::canValidate($user)) {
            throw ValidationException::withMessages(['payment' => 'Validation réservée à la finance ou au super admin.']);
        }

        return DB::transaction(function () use ($payment, $user, $note, $source, $transactionId) {
            $p = Payment::lockForUpdate()->findOrFail($payment->id);
            if ($p->status === PaymentStatus::Confirmed) {
                return $p;
            }
            if (! in_array($p->status, [PaymentStatus::Awaiting, PaymentStatus::PendingVerification], true)) {
                throw ValidationException::withMessages(['payment' => 'Paiement '.$p->status->label().' : confirmation impossible.']);
            }
            $p->forceFill(['confirmed_at' => now(), 'confirmed_by' => $user?->id, 'provider_transaction_id' => $transactionId ?? $p->provider_transaction_id])->save();
            $this->move($p, PaymentStatus::Confirmed, 'confirmed', $user, $source, $note);
            if ($p->shop_order_id) {
                $this->syncShopOrder($p->shopOrder()->firstOrFail());
            } else {
                $this->syncOrder($p->order()->firstOrFail());
            }

            return $p;
        });
    }

    public function reject(Payment $payment, ?User $user, string $note): Payment
    {
        if (! self::canValidate($user)) {
            throw ValidationException::withMessages(['payment' => 'Validation réservée à la finance ou au super admin.']);
        }
        if (mb_strlen(trim($note)) < 3) {
            throw ValidationException::withMessages(['payment' => 'Indiquez le motif du refus.']);
        }

        return DB::transaction(function () use ($payment, $user, $note) {
            $p = Payment::findOrFail($payment->id);
            if ($p->status !== PaymentStatus::PendingVerification) {
                throw ValidationException::withMessages(['payment' => 'Seul un justificatif en vérification peut être refusé.']);
            }
            $this->move($p, PaymentStatus::Rejected, 'rejected', $user, 'admin', $note);
            if ($p->shop_order_id) {
                ShopOrder::whereKey($p->shop_order_id)->update(['paymentStatus' => 'echec']);
            }

            return $p;
        });
    }

    /** Order follows its payments while it is still in the payment phase. */
    private function syncOrder(CustomerOrder $order): void
    {
        if (! in_array($order->status, [OrderStatus::AwaitingPayment, OrderStatus::PartiallyPaid], true)) {
            return;
        }
        $active = collect($this->schedule($order));
        $paid = $active->filter(fn (Payment $p) => $p->status === PaymentStatus::Confirmed)->sum('amount');
        $target = $paid >= $order->total_ttc ? OrderStatus::PaymentConfirmed : ($paid > 0 ? OrderStatus::PartiallyPaid : null);
        if ($target && $target !== $order->status) {
            app(OrderService::class)->transition($order, $target, null, "Paiements confirmés : {$paid} / {$order->total_ttc} {$order->currency}.", 'payment');
        }
    }

    /** Site order: fully paid -> « Payée », and a new order moves to « Confirmé » (history row like the back office). */
    private function syncShopOrder(ShopOrder $order): void
    {
        $paid = (int) Payment::where('shop_order_id', $order->id)->where('status', PaymentStatus::Confirmed->value)->sum('amount');
        if ($paid < (int) $order->total) {
            return;
        }
        $order->update(['paymentStatus' => 'paye']);
        if (in_array((string) $order->status, ['nouveau', 'à contacter', 'en cours'], true)) {
            $from = (string) $order->status;
            $order->update(['status' => 'confirmé']);
            Activity::create(['orderId' => $order->id, 'fromStatus' => $from, 'toStatus' => 'confirmé', 'createdAt' => now()]);
        }
    }

    private function move(Payment $p, PaymentStatus $to, string $type, ?User $user, string $source, ?string $note, ?string $ip = null, ?array $meta = null): void
    {
        $from = $p->status;
        $p->forceFill(['status' => $to])->save();
        $this->log($p, $type, $from, $to, $user, $source, $note, $ip, $meta);
    }

    private function log(Payment $p, string $type, ?PaymentStatus $from, PaymentStatus $to, ?User $user, string $source, ?string $note, ?string $ip = null, ?array $meta = null): void
    {
        PaymentTransaction::create(['payment_id' => $p->id, 'customer_order_id' => $p->customer_order_id, 'shop_order_id' => $p->shop_order_id, 'type' => $type, 'from_status' => $from?->value, 'to_status' => $to->value,
            'amount' => $p->amount, 'note' => $note ? mb_substr($note, 0, 1000) : null, 'source' => $source, 'user_id' => $user?->id, 'ip' => $ip, 'meta' => $meta]);
    }

    private function notifyTeam(CustomerOrder $order, string $details, string $key): void
    {
        $to = TransactionalMail::teamAddress();
        if ($to) {
            $this->mail->send($to, 'FAW — commande '.$order->reference.' : paiement', "Commande {$order->reference} — {$order->client_name} ({$order->city}).\n{$details}\n\nÀ traiter dans le back-office FAW (Commandes clients).", 'faw-team-order-'.$order->id.'-'.$key);
        }
    }

    private function notifyTeamShop(ShopOrder $order, string $details, string $key): void
    {
        $to = TransactionalMail::teamAddress();
        if ($to) {
            $short = substr((string) $order->number, 0, 17);
            $this->mail->send($to, 'FAW — commande site '.$short.' : paiement', "Commande site {$short}… — {$order->customerName} ({$order->city}).\n{$details}\n\nÀ traiter dans le back-office FAW (Commandes / demandes).", 'faw-team-shop-order-'.$order->id.'-'.$key);
        }
    }

    /** Payment block of the site order confirmation page (reached with the private order number only). */
    public function shopOrderState(ShopOrder $order): ?array
    {
        $p = Payment::where('shop_order_id', $order->id)->where('status', '!=', PaymentStatus::Cancelled->value)->orderBy('id')->first();
        if (! $p) {
            return null;
        }
        $prov = $this->providers->get($p->provider);
        $open = in_array($p->status, [PaymentStatus::Awaiting, PaymentStatus::Rejected], true) && ! in_array((string) $order->status, ShopOrder::FINAL, true);

        return ['reference' => $p->reference, 'amount' => (int) $p->amount, 'currency' => $p->currency, 'status' => $p->status->value, 'method' => $p->provider,
            'proofUploaded' => $p->proof_uploaded_at !== null, 'canUploadProof' => (bool) $prov?->acceptsProof() && $open,
            'canPayByCard' => $p->provider === 'cmi' && $open && (bool) $prov?->enabled(),
            'bank' => $p->provider === 'bank_transfer' ? BankTransferProvider::bank() : null,
            'proofRules' => ['types' => ['pdf', 'jpg', 'png'], 'maxBytes' => self::PROOF_MAX_BYTES]];
    }

    public function portalState(CustomerOrder $order): array
    {
        $payments = array_map(function (Payment $p) use ($order) {
            $prov = $this->providers->get($p->provider);

            return ['id' => $p->id, 'label' => $p->label, 'amount' => $p->amount, 'currency' => $p->currency, 'reference' => $p->reference, 'status' => $p->status->value,
                'method' => $p->provider, 'proofUploaded' => $p->proof_uploaded_at !== null,
                'canUploadProof' => (bool) $prov?->acceptsProof() && in_array($p->status, [PaymentStatus::Awaiting, PaymentStatus::Rejected], true) && ! $order->status->isFinal()];
        }, $this->schedule($order));
        $paid = array_sum(array_map(fn ($p) => $p['status'] === 'confirme' ? $p['amount'] : 0, $payments));

        return ['payments' => $payments, 'paid' => $paid, 'due' => max(0, $order->total_ttc - $paid), 'bank' => BankTransferProvider::bank(), 'cardAvailable' => false,
            'proofRules' => ['types' => ['pdf', 'jpg', 'png'], 'maxBytes' => self::PROOF_MAX_BYTES]];
    }
}
