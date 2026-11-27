<?php

namespace App\Filament\Widgets\Concerns;

/** FAW chart colours: brand orange first, then readable warm neutrals and status colours. */
final class ChartPalette
{
    public const BRAND = '#f38f26';

    public const BRAND_SOFT = 'rgba(243, 143, 38, 0.18)';

    public const NEUTRAL = '#78716c';

    public const NEUTRAL_SOFT = 'rgba(120, 113, 108, 0.25)';

    public const DARK = '#44403c';

    /** Pipeline stages of the "Commandes par statut" chart. */
    public const STAGES = [
        'À traiter' => '#f59e0b',
        'En attente de paiement' => '#fbbf24',
        'En cours' => '#3b82f6',
        'Confirmée / payée' => '#f38f26',
        'Livrée / terminée' => '#16a34a',
        'Annulée' => '#a8a29e',
        'Autre' => '#d6d3d1',
    ];
}
