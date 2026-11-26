<?php

return [
    'generator' => env('DEVIS_GENERATOR_SCRIPT'), 'counter' => env('DEVIS_COUNTER_SCRIPT'), 'journal' => env('DEVIS_JOURNAL_PATH'),
    'output' => env('DEVIS_OUTPUT_DIR', storage_path('app/private/devis')), 'python' => env('PYTHON_BIN', 'python3'),
    'resend_key' => env('RESEND_API_KEY'), 'email_from' => env('QUOTE_EMAIL_FROM'), 'email_reply_to' => env('QUOTE_EMAIL_REPLY_TO'),
    'site_url' => env('APP_URL'),
    // Lifetime of a customer quote link (days). Revocation and regeneration from Filament.
    'quote_link_ttl_days' => (int) env('QUOTE_LINK_TTL_DAYS', 90),

    /*
     * Quote versions. Version 1 carries the reserved number itself (from prochain_numero.py).
     * Later versions are labelled with this format (provisional choice, Walfar may change it here only):
     * {numero} = reserved number, {version} = 2, 3, ...  PDF files stay Devis-<numero>-FAW-<version>.pdf.
     */
    'quote_version_format' => env('QUOTE_VERSION_FORMAT', '{numero}-{version}'),
    // Frozen into every issued version (mirrors the Meta Closer generator text; delivery is an option outside the total).
    'quote_validity_days' => 14,
    'quote_tax_rate' => 20,
    'quote_currency' => 'MAD',
    'quote_conditions' => [
        'Fourniture seule, installation non incluse.',
        'Retrait au dépôt gratuit ; livraison en option, hors total.',
        'Ce devis est valable 14 jours à compter de sa date.',
        'Règlement par virement ou chèque encaissé avant retrait de la marchandise.',
        'Toute commande sans bon de commande ne sera prise en compte.',
        'La marchandise reste la propriété de la société FAW jusqu’au règlement définitif de la facture.',
    ],

    // Customer portal (private quote link): internal notification address and acceptance code limits.
    'team_email' => env('FAW_TEAM_EMAIL'),
    'otp_ttl_minutes' => 10,
    'otp_max_attempts' => 5,
    // Pickup address shown to customers: empty until FAW provides it (portal then shows « adresse communiquée par FAW »).
    'pickup_address' => env('FAW_PICKUP_ADDRESS', ''),
    // Bank transfer details: EMPTY until FAW provides them (portal then shows « RIB communiqué par FAW »). Never invent.
    'bank' => [
        'rib' => env('FAW_BANK_RIB', ''),
        'holder' => env('FAW_BANK_HOLDER', ''),
        'bank_name' => env('FAW_BANK_NAME', ''),
        'swift' => env('FAW_BANK_SWIFT', ''),
        'iban' => env('FAW_BANK_IBAN', ''),
        'branch' => env('FAW_BANK_BRANCH', ''),
    ],
    // Card payment: DISABLED (adapter stub only). The webhook answers 503; see docs/payment-providers.md.
    'card' => [
        'provider' => env('FAW_CARD_PROVIDER', ''),
        'webhook_secret' => env('FAW_CARD_WEBHOOK_SECRET', ''),
    ],
];
