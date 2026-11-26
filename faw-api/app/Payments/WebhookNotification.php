<?php

namespace App\Payments;

final class WebhookNotification
{
    public function __construct(
        public readonly string $eventId,
        public readonly string $reference,
        public readonly int $amount,
        public readonly string $currency,
        public readonly bool $paid,
        public readonly ?string $transactionId,
    ) {}
}
