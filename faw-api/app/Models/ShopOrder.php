<?php

namespace App\Models;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShopOrder extends ShopModel
{
    /** Shop order / request statuses, in business order (Kanban columns follow this order). */
    public const STATUSES = [
        'nouveau' => 'Nouveau',
        'à contacter' => 'À contacter',
        'en cours' => 'En cours',
        'devis envoyé' => 'Devis envoyé',
        'confirmé' => 'Confirmé',
        'livré' => 'Livré',
        'annulé' => 'Annulé',
    ];

    /** Final statuses: only a super administrator may move an order out of them. */
    public const FINAL = ['livré', 'annulé'];

    public const PAYMENT_METHODS = [
        'virement' => 'Virement bancaire',
        'cheque' => 'Chèque',
        'reception' => 'Paiement à la livraison / au retrait',
        'carte' => 'Carte bancaire (CMI)',
        'à définir' => 'À définir',
    ];

    /** Payment state of a site order (follows its payment row; see PaymentService). */
    public const PAYMENT_STATUSES = [
        'en_attente' => 'En attente de paiement',
        'en_verification' => 'Justificatif à vérifier',
        'a_la_livraison' => 'À encaisser à la livraison / au retrait',
        'paye' => 'Payée',
        'echec' => 'Paiement refusé / échoué',
    ];

    public static function paymentStatusLabel(?string $status): string
    {
        return self::PAYMENT_STATUSES[(string) $status] ?? ((string) $status ?: '—');
    }

    public function payments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Payment::class, 'shop_order_id')->orderBy('id');
    }

    protected $table = 'Order';

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['cgvAccepted' => 'boolean'];

    public static function statusLabel(?string $status): string
    {
        return self::STATUSES[(string) $status] ?? (string) $status;
    }

    public static function paymentLabel(?string $method): string
    {
        return self::PAYMENT_METHODS[(string) $method] ?? ((string) $method ?: '—');
    }

    /** Same rule as the edit form: order writers (sales, logistics) and finance. */
    public static function canChangeStatus(?User $user): bool
    {
        return (bool) ($user && ($user->canDo('write.orders') || $user->canDo('write.finance')));
    }

    /**
     * Single path for back-office status changes (edit page, Kanban): checks the role and the target,
     * keeps final statuses locked (except super admin), saves (audited by ShopModel) and writes the
     * LeadEvent history row, like the storefront and the quote e-mail flow do.
     */
    public function changeStatus(string $to, ?User $user): self
    {
        if (! static::canChangeStatus($user)) {
            throw ValidationException::withMessages(['status' => 'Changement de statut non autorisé pour votre rôle.']);
        }
        if (! array_key_exists($to, self::STATUSES)) {
            throw ValidationException::withMessages(['status' => 'Statut inconnu.']);
        }

        return DB::transaction(function () use ($to, $user) {
            $fresh = static::query()->lockForUpdate()->findOrFail($this->getKey());
            $from = (string) $fresh->status;
            if ($from === $to) {
                return $fresh;
            }
            if (in_array($from, self::FINAL, true) && ! $user?->canDo('*')) {
                throw ValidationException::withMessages(['status' => 'Commande '.mb_strtolower(self::statusLabel($from)).' : statut final.']);
            }
            $fresh->update(['status' => $to]);
            Activity::create(['orderId' => $fresh->getKey(), 'fromStatus' => $from, 'toStatus' => $to, 'createdAt' => now()]);

            return $fresh;
        });
    }
}
