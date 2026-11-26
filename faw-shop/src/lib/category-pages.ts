import type { CategoryKey, Faq } from "./products";

/** Pages catégorie indexables (H1 mot-clé + ville, introduction, FAQ). */
export type CategoryLanding = {
  slug: string;
  key: CategoryKey;
  h1: string;
  title: string; // <title> ≤ 60
  description: string; // ≤ 160
  intro: string[];
  faq: Faq[];
};

export const CATEGORY_LANDINGS: CategoryLanding[] = [
  {
    slug: "portes-coupe-feu",
    key: "portes-coupe-feu",
    h1: "Portes coupe-feu EI60 à Casablanca",
    title: "Porte coupe-feu EI60 à Casablanca – prix sur devis",
    description: "Portes coupe-feu EI60 1 et 2 vantaux, de 80 à 200 cm, en stock à Casablanca. Prix sur devis, devis PDF en ligne, pose non comprise.",
    intro: [
      "FAW Aluminium propose des portes coupe-feu EI60 en acier galvanisé avec isolation en laine de roche et joint intumescent, en 1 vantail (80 à 120 cm) et 2 vantaux (120 à 200 cm). Chaque taille a sa fiche avec photo et caractéristiques. Prix sur devis.",
      "Les portes sont livrées avec poignée, cylindre, serrure et clés. Barre anti-panique et ferme-porte sont disponibles en option. Retrait gratuit au dépôt de Casablanca ou livraison : transport à confirmer sur devis. Pose non comprise.",
    ],
    faq: [
      { q: "Quelle taille de porte coupe-feu choisir ?", a: "Mesurez la largeur du passage : 80, 90 ou 100 cm conviennent à la plupart des portes de service ; au-delà de 120 cm, choisissez une porte 2 vantaux. La hauteur standard est de 212,5 cm." },
      { q: "La pose est-elle comprise ?", a: "Non : le devis concerne la fourniture seule. La pose n'est pas comprise." },
      { q: "Livrez-vous hors de Casablanca ?", a: "Oui, le transport est confirmé sur le devis. Le retrait au dépôt est gratuit." },
      { q: "Comment obtenir un devis ?", a: "Remplissez le formulaire de devis : l'équipe FAW valide votre demande et vous envoie un devis PDF valable 14 jours, avec le total HT et TTC. Paiement par virement ou chèque." },
    ],
  },
  {
    slug: "portes-galandage",
    key: "galandage",
    h1: "Portes galandage à Casablanca : châssis coulissants encastrables",
    title: "Porte galandage à Casablanca – châssis 60 à 100 cm",
    description: "Châssis pour porte coulissante à galandage, cloison placo, passages de 60 à 100 cm. Prix sur devis à Casablanca, devis PDF en ligne, pose non comprise.",
    intro: [
      "Le châssis à galandage permet à la porte de coulisser à l'intérieur de la cloison : plus de débattement, plus de place dans la pièce. Nos châssis sont prévus pour cloison en plaque de plâtre (placo), pour des passages de 60 à 100 cm.",
      "Chaque châssis est livré avec 2 chariots, un frein ABS, un guide inférieur et le rail. Le vantail (la porte) n'est pas inclus. Retrait au dépôt de Casablanca ou livraison sur devis. Pose non comprise.",
    ],
    faq: [
      { q: "Le vantail est-il fourni ?", a: "Non, le devis concerne le châssis et sa quincaillerie ; la porte (vantail) n'est pas incluse." },
      { q: "Pour quel type de cloison ?", a: "Pour cloison en plaque de plâtre (placo)." },
      { q: "La pose est-elle comprise ?", a: "Non, fourniture seule : la pose n'est pas comprise." },
    ],
  },
  {
    slug: "incendie",
    key: "incendie",
    h1: "Extincteurs et matériel incendie à Casablanca",
    title: "Extincteurs et matériel incendie à Casablanca – prix sur devis",
    description: "Extincteurs poudre ABC, CO2, eau pulvérisée, automatiques, RIA et poteau incendie à Casablanca. Prix sur devis, devis PDF en ligne, installation non comprise.",
    intro: [
      "Extincteurs poudre ABC (6 et 9 kg, 50 kg sur roues), CO2 (2, 5 et 6 kg) pour les feux d'origine électrique, eau pulvérisée (6 et 9 L) et extincteurs automatiques, ainsi que RIA, poteau incendie et chariot mousse.",
      "Prix sur devis. Retrait au dépôt de Casablanca ou livraison sur devis. L'installation n'est pas comprise.",
    ],
    faq: [
      { q: "Quel extincteur pour un local électrique ?", a: "L'extincteur CO2 (classe B) est adapté aux armoires électriques et locaux techniques." },
      { q: "Quel extincteur pour un bureau ou un logement ?", a: "L'extincteur poudre ABC 6 kg est polyvalent (classes A, B et C)." },
      { q: "L'installation est-elle comprise ?", a: "Non, le devis concerne la fourniture seule." },
      { q: "Comment obtenir un devis ?", a: "Remplissez le formulaire de devis : l'équipe FAW le valide et vous envoie le PDF, valable 14 jours. Paiement par virement ou chèque." },
    ],
  },
];

export function getLanding(slug: string) {
  return CATEGORY_LANDINGS.find((c) => c.slug === slug.toLowerCase());
}
