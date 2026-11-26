<?php

namespace App\Payments;

/** Registry of adapters. Only bank transfer is enabled. */
class PaymentProviders
{
    /** @var array<string, PaymentProvider> */
    private array $providers = [];

    public function __construct(BankTransferProvider $bank, CardProvider $card)
    {
        $this->register($bank)->register($card);
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
