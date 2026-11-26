import { categoryKey, type Product } from "./products";

/**
 * Applications affichées sur la fiche : uniquement des usages déjà publiés et validés par FAW
 * (textes catégorie / fiche existants). Aucun usage inventé ; vide = section masquée.
 */
export function applications(p: Product): string[] {
  const cat = categoryKey(p);
  if (cat === "portes-coupe-feu") return ["Locaux techniques", "Parkings", "Cages d'escalier", "Logements"];
  if (cat === "galandage") return ["Cloison en plaque de plâtre (placo) : la porte coulisse dans la cloison pour gagner de la place"];
  if (cat === "incendie") {
    if (/CO2/i.test(p.id) || /CO2/i.test(p.title)) return ["Armoires électriques et locaux techniques (feux d'origine électrique)"];
    if (/PABC/i.test(p.id) && /\b6\s?kg\b/i.test(p.title)) return ["Bureaux et logements (classes A, B et C)"];
  }
  if (cat === "automatisme") return ["Portail battant à deux vantaux, jusqu'à 350 kg par vantail"];
  return [];
}
