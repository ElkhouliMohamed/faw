<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

/**
 * Remplit le texte « Détails » des fiches produit à partir des seules données déjà présentes
 * (description, variante). Idempotent : ne touche jamais un champ déjà renseigné par l'équipe.
 * Le guide d'installation et la fiche technique restent vides : aucune donnée source.
 */
class FillProductContent extends Command
{
    protected $signature = 'faw:product-content {--dry-run}';

    protected $description = 'Compléter les détails des fiches produit (faits du catalogue uniquement, champs vides seulement)';

    public function handle(): int
    {
        $n = 0;
        foreach (Product::all() as $p) {
            if (filled($p->details)) {
                continue;
            }
            $text = self::details($p);
            if (! $text) {
                continue;
            }
            $n++;
            $this->line($p->id);
            if (! $this->option('dry-run')) {
                $p->details = $text;
                $p->save();
            }
        }
        $this->info("$n fiche(s) complétée(s)");

        return 0;
    }

    public static function details(Product $p): ?string
    {
        $d = (string) $p->description;
        $cat = (string) $p->category;
        if ($cat === 'Portes coupe-feu' && preg_match('/Dimensions : (.+? cm), (\d vantau?[xil]+)\./u', $d, $m)) {
            $two = str_starts_with($m[2], '2');

            return implode("\n\n", [
                "Porte coupe-feu EI60 de {$m[1]}, {$m[2]}, en acier galvanisé avec isolation en laine de roche et joint intumescent. La finition est blanche (proche RAL 9018).",
                'La porte est fournie avec poignée, cylindre, serrure et clés. '.($two ? 'Barre anti-panique 2 vantaux' : 'Barre anti-panique 1 vantail').' et ferme-porte sont proposés en option.',
                'Usages courants : locaux techniques, parkings, cages d\'escalier et logements. Prix TTC, fourniture seule : la pose n\'est pas comprise.',
            ]);
        }
        if ($cat === 'Portes coulissantes encastrables' && preg_match('/Passage : ([^.]+)\./u', $d, $m)) {
            return implode("\n\n", [
                "Châssis pour porte coulissante à galandage, 1 vantail, pour un passage de {$m[1]}. Il s'intègre dans une cloison en plaque de plâtre (placo) : la porte coulisse à l'intérieur de la cloison et libère la place d'un battant.",
                'Le colis contient 2 chariots, 1 frein ABS, 1 guide inférieur et le rail. Le vantail (la porte) n\'est pas inclus. Prix TTC, pose non comprise.',
            ]);
        }
        if ($cat === 'Automatisme') {
            return implode("\n\n", [
                'Kit d\'automatisation G-BAT 300 (Genius, fabriqué en Italie), 230V, pour portail battant 2 vantaux, jusqu\'à 350 kg et environ 3 m par vantail.',
                'Le kit contient 2 vérins, une armoire de commande, 2 télécommandes, une lampe clignotante, des photocellules et un sélecteur à clé. Au-delà de 2,50 m par vantail, une serrure électrique est nécessaire.',
                'Fourniture seule, pose non comprise.',
            ]);
        }
        if ($cat === 'Incendie') {
            $sentences = preg_split('/(?<=\.)\s+/u', $d);
            $keep = array_values(array_filter($sentences, fn ($s) => ! preg_match('/^(Prix TTC|FAW Aluminium|Installation non comprise)/u', $s)));

            return $keep ? implode(' ', $keep)."\n\nPrix TTC, fourniture seule : l'installation n'est pas comprise." : null;
        }

        return null;
    }
}
