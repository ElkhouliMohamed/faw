<?php

namespace App\Payments;

/** Registry of adapters. Bank transfer always; cash on delivery and CMI follow the back-office settings; « card » stays a disabled stub. */
class PaymentProviders
{
    /** @var array<string, PaymentProvider> */
    private array $providers = [];

    public function __construct(BankTransferProvider $bank, CardProvider $card, CashOnDeliveryProvider $cod, CmiProvider $cmi)
    {
        $this->register($bank)->register($card)->register($cod)->register($cmi);
    }

    public function register(PaymentProvider $p): static
    {
        $this->providers[$p->key()] = $p;

        return $this;
    }

    public function get(string $key): ?PaymentProvider
    {
        return $this->providers[$key] ?? null;
    }
}
