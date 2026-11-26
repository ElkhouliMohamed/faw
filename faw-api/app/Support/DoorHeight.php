<?php

namespace App\Support;

use App\Models\Product;
use Illuminate\Support\Facades\DB;

/**
 * Hauteur des portes coupe-feu, extraite uniquement des fiches déjà saisies
 * (détails, description, attribut « hauteur »). Aucune valeur n'est inventée.
 */
class DoorHeight
{
    /** Hauteur en cm, virgule française, sans unité (ex. « 212,5 »). */
    public static function fromText(?string $text): ?string
    {
        if (! $text) {
            return null;
        }
        if (preg_match('/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm/u', $text, $m)) {
            return str_replace('.', ',', $m[2]);
        }

        return null;
    }

    public static function fromProduct(Product $p): ?string
    {
        $attrs = json_decode((string) ($p->attributes ?: '{}'), true);
        if (is_array($attrs) && filled($attrs['hauteur'] ?? null)) {
            return trim((string) preg_replace('/\s*cm$/iu', '', (string) $attrs['hauteur']));
        }

        return self::fromText($p->details) ?? self::fromText($p->description);
    }

    /** Crée l'attribut et renseigne les portes qui ont une hauteur vérifiée, sans écraser une valeur déjà saisie. */
    public static function backfill(): int
    {
        $now = now()->getTimestampMs();
        if (! DB::table('Attribute')->where('key', 'hauteur')->exists()) {
            DB::table('Attribute')->insert([
                'key' => 'hauteur',
                'label' => 'Hauteur',
                'unit' => 'cm',
                'kind' => 'number',
                'options' => '',
                'sortOrder' => 10,
                'showInSpecs' => 1,
                'active' => 1,
                'createdAt' => $now,
                'updatedAt' => $now,
            ]);
        }

        $n = 0;
        foreach (DB::table('Product')->where('category', 'Portes coupe-feu')->get() as $row) {
            $attrs = json_decode((string) ($row->attributes ?: '{}'), true);
            if (! is_array($attrs)) {
                $attrs = [];
            }
            if (filled($attrs['hauteur'] ?? null)) {
                continue;
            }
            $height = self::fromText($row->details ?? null) ?? self::fromText($row->description ?? null);
            if (! $height) {
                continue;
            }
            $attrs['hauteur'] = $height;
            DB::table('Product')->where('id', $row->id)->update([
                'attributes' => json_encode($attrs, JSON_UNESCAPED_UNICODE),
                'updatedAt' => $now,
            ]);
            $n++;
        }

        return $n;
    }
}
