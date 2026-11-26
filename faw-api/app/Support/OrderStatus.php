<?php

namespace App\Support;

use App\Models\User;

enum OrderStatus: string
{
    case AwaitingPayment = 'en_attente_paiement';
    case PartiallyPaid = 'partiellement_paye';
    case PaymentConfirmed = 'paiement_confirme';
    case Processing = 'en_traitement';
    case Preparing = 'en_preparation';
    case ReadyForPickup = 'pret_retrait';
    case InDelivery = 'en_livraison';
    case Delivered = 'livre';
    case Completed = 'termine';
    case Cancelled = 'annule';

    public function label(): string
    {
        return match ($this) {
            self::AwaitingPayment => 'En attente de paiement',
            self::PartiallyPaid => 'Partiellement payée',
            self::PaymentConfirmed => 'Paiement confirmé',
            self::Processing => 'En traitement',
            self::Preparing => 'En préparation',
            self::ReadyForPickup => 'Prête au retrait',
            self::InDelivery => 'En livraison',
            self::Delivered => 'Livrée',
            self::Completed => 'Terminée',
            self::Cancelled => 'Annulée',
        };
    }

    /** @return array<string, string> */
    public static function options(?array $only = null): array
    {
        $out = [];
        foreach (self::cases() as $c) {
            if ($only === null || in_array($c, $only, true)) {
                $out[$c->value] = $c->label();
            }
        }

        return $out;
    }

    /** Statuses a user may set: sales manager / super admin all, logistics the delivery steps, finance the payment steps. */
    public static function allowedFor(?User $user): array
    {
        if (! $user) {
            return [];
        }
        if ($user->canDo('manage.customer_orders')) {
            return self::cases();
        }
        $out = [];
        if ($user->canDo('write.shipping')) {
            array_push($out, self::Processing, self::Preparing, self::ReadyForPickup, self::InDelivery, self::Delivered, self::Completed);
        }
        if ($user->canDo('write.finance')) {
            array_push($out, self::AwaitingPayment, self::PartiallyPaid, self::PaymentConfirmed);
        }

        return array_values(array_unique($out, SORT_REGULAR));
    }

    public function isFinal(): bool
    {
        return in_array($this, [self::Completed, self::Cancelled], true);
    }
}
