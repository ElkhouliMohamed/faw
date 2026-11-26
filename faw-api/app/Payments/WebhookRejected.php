<?php

namespace App\Payments;

class WebhookRejected extends \RuntimeException
{
    public function __construct(public readonly string $reason, public readonly int $status = 400)
    {
        parent::__construct($reason);
    }
}
