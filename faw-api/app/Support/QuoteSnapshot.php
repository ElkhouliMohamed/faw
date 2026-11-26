<?php

namespace App\Support;

use Carbon\CarbonInterface;

/**
 * Pure builder for the frozen content of an issued quote version.
 * Input lines use the priced-line shape stored on Quote.lines (id, title, category, qty, unit TTC, total, override).
 */
class QuoteSnapshot
{
    public static function label(string $number, int $version): string
    {
        if ($version <= 1) {
            return $number;
        }

        return strtr((string) config('faw.quote_version_format', '{numero}-{version}'), ['{numero}' => $number, '{version}' => (string) $version]);
    }

    public static function pdfName(string $number, int $version): string
    {
        return $version <= 1 ? 'Devis-'.$number.'-FAW.pdf' : 'Devis-'.$number.'-FAW-'.$version.'.pdf';
    }

    /** Transport input of the generator -> frozen delivery block. Only casablanca/rabat/autre would count in the total. */
    public static function delivery(array $transport, string $label = ''): array
    {
        $mode = strtolower((string) ($transport['mode'] ?? 'a_confirmer'));
        $amount = isset($transport['montant']) && is_numeric($transport['montant']) ? (int) round((float) $transport['montant']) : null;

        return [
            'mode' => $mode,
            'city' => $transport['ville'] ?? null,
            'amount_ttc' => $mode === 'retrait' ? 0 : $amount,
            'in_total' => in_array($mode, ['casablanca', 'rabat', 'autre'], true),
            'label' => $label !== '' ? $label : self::deliveryLabel($mode, $transport['ville'] ?? null, $amount),
        ];
    }

    public static function deliveryLabel(string $mode, ?string $city, ?int $amount): string
    {
        return match ($mode) {
            'retrait' => 'Retrait au dépôt (gratuit)',
            'option' => trim(($city ?: 'Livraison').' : '.$amount.' DH TTC en option, hors total'),
            default => ($city ? $city.' : ' : '').'transport à confirmer, hors total',
        };
    }

    /** @return array{lines: array, totals: array, delivery: array} */
    public static function build(array $pricedLines, array $transport, string $deliveryLabel, ?float $kitLeaf = null): array
    {
        $tax = (int) config('faw.quote_tax_rate', 20);
        $lines = [];
        foreach (array_values($pricedLines) as $i => $l) {
            $qty = (int) $l['qty'];
            $unit = (int) $l['unit'];
            $config = array_filter([
                'category' => $l['category'] ?? null,
                'largeur_vantail_m' => str_starts_with((string) $l['id'], 'AUTO-GBAT300') && $kitLeaf ? $kitLeaf : null,
                'tarif_specifique' => ! empty($l['override']) ? true : null,
            ], fn ($v) => $v !== null);
            $lines[] = [
                'position' => $i + 1,
                'reference' => (string) $l['id'],
                'name' => (string) ($l['title'] ?? $l['id']),
                'qty' => $qty,
                'config' => $config,
                'unit_ttc' => $unit,
                'unit_ht' => round($unit / (1 + $tax / 100), 2),
                'discount_rate' => 0,
                'discount_ttc' => 0,
                'tax_rate' => $tax,
                'total_ttc' => $unit * $qty,
                'total_ht' => round($unit * $qty / (1 + $tax / 100), 2),
            ];
        }
        $delivery = self::delivery($transport, $deliveryLabel);
        $subtotal = array_sum(array_column($lines, 'total_ttc'));
        $total = $subtotal + ($delivery['in_total'] ? (int) $delivery['amount_ttc'] : 0);
        $ht = round($total / (1 + $tax / 100), 2);

        return [
            'lines' => $lines,
            'delivery' => $delivery,
            'totals' => [
                'subtotal_ttc' => $subtotal,
                'discount_ttc' => 0,
                'total_ht' => $ht,
                'tax_rate' => $tax,
                'tax_amount' => round($total - $ht, 2),
                'total_ttc' => $total,
            ],
        ];
    }

    public static function validUntil(CarbonInterface $issuedAt): string
    {
        return $issuedAt->copy()->setTimezone('Africa/Casablanca')->addDays((int) config('faw.quote_validity_days', 14))->format('Y-m-d');
    }
}
