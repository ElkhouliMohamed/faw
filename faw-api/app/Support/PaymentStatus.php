<?php

namespace App\Support;

enum PaymentStatus: string
{
    case Awaiting = 'en_attente';
    case PendingVerification = 'en_verification';
    case Confirmed = 'confirme';
    case Rejected = 'rejete';
    case Cancelled = 'annule';

    public function label(): string
    {
        return match ($this) {
            self::Awaiting => 'En attente',
            self::PendingVerification => 'En vérification',
            self::Confirmed => 'Confirmé',
            self::Rejected => 'Justificatif refusé',
            self::Cancelled => 'Annulé',
        };
    }

    public function counts(): bool
    {
        return $this !== self::Cancelled;
    }
}
