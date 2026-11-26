// Types + règles catalogue partagées (client & serveur). Les données vivent en base (back-office « Stock »),
// initialisées depuis data/products.json sans modification (voir src/lib/catalog.ts).

export const AVAILABILITIES = ["en stock", "bientôt disponible", "indisponible", "sur commande"] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export type Product = {
  id: string;
  slug: string;
  title: string;
  /** Titre long du flux Merchant (conservé pour le flux / l'admin). */
  seoTitle: string;
  description: string;
  shortDescription: string | null;
  h1?: string;
  price: number;
  category: string;
  brand: string;
  image: string | null;
  availability: Availability;
  stockQty: number | null;
  priceToConfirm: boolean;
  stockToConfirm: boolean;
  stockNote: string | null;
  variantGroup: string | null;
  variantLabel: string | null;
  sortOrder: number;
  active: boolean;
  updatedAt?: Date;
  metaTitle?: string;
  metaDescription?: string;
  badges?: string;
  warrantyId?: number | null;
  attributes?: string;
  /** Texte « Détails » saisi au back-office (paragraphes séparés par une ligne vide). */
  details?: string | null;
  /** Guide d'installation (une étape par ligne). Vide = section réduite aux vérifications avant pose. */
  installationGuide?: string | null;
  /** Fiche technique PDF publique (/storage/fiches-techniques/…). */
  datasheet?: string | null;
  /** Guide de pose & entretien PDF public (/storage/guides-pose-entretien/…). */
  maintenanceGuide?: string | null;
  /** Si fourni par l'API publique (nécessaire quand le prix n'est pas envoyé). */
  orderable?: boolean;
  /* Dérivés au chargement (catalog.ts) */
  /** Prix de base saisi au back-office (avant promotion). */
  basePrice?: number;
  /** Prix barré quand une promotion est active (= prix de base). */
  compareAt?: number | null;
  promoName?: string | null;
  catSlug?: string;
  family?: CategoryKey;
  badgeList?: PublicBadge[];
};
export type PublicBadge = { label: string; tone: string };

export type CategoryKey = "portes-coupe-feu" | "galandage" | "automatisme" | "incendie";

export const CATEGORIES: { key: CategoryKey; label: string; short: string; image: string; code: string; page?: string }[] = [
  { key: "portes-coupe-feu", label: "Portes coupe-feu", short: "Coupe-feu EI60", image: "/images/products/v7-2/CF-EI60-140-2V-photo.jpg", code: "EI60", page: "/produits/portes-coupe-feu" },
  { key: "galandage", label: "Portes coulissantes encastrables", short: "Galandage", image: "/images/products/v6/GAL-800.jpg", code: "GAL", page: "/produits/portes-galandage" },
  { key: "incendie", label: "Incendie", short: "Matériel incendie", image: "/images/products/v6/EXT-CO2-6.jpg", code: "EXT", page: "/produits/incendie" },
  { key: "automatisme", label: "Automatisme", short: "Kit portail", image: "/images/products/v6/AUTO-GBAT300-230V.jpg", code: "AUTO" },
];

/** Lien interne vers la catégorie : page indexable si elle existe, sinon filtre du catalogue. */
export function categoryHref(key: CategoryKey) {
  return CATEGORIES.find((c) => c.key === key)?.page ?? `/produits?categorie=${key}`;
}

const CAT_BY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.label, c.key])) as Record<string, CategoryKey>;

export function categoryKey(p: Pick<Product, "category"> & { family?: CategoryKey }): CategoryKey {
  return p.family ?? CAT_BY_LABEL[p.category] ?? "incendie";
}

export const FEATURED_IDS = ["CF-EI60-90", "CF-EI60-140-2V", "GAL-800", "AUTO-GBAT300-230V", "EXT-PABC-6", "EXT-CO2-5"];

/** Disponibilité réelle : un stock suivi à 0 rend le produit indisponible. */
export function effectiveAvailability(p: Pick<Product, "availability" | "stockQty">): Availability {
  if (p.availability === "en stock" && p.stockQty !== null && p.stockQty <= 0) return "indisponible";
  return p.availability;
}
/** Peut être ajouté au panier / commandé. */
export function canOrder(p: Pick<Product, "availability" | "stockQty" | "price" | "active"> & { orderable?: boolean }) {
  if (typeof p.orderable === "boolean") return p.orderable;
  const a = effectiveAvailability(p);
  return p.active && (p.price ?? 0) > 0 && (a === "en stock" || a === "sur commande");
}
export const SCHEMA_AVAILABILITY: Record<Availability, string> = {
  "en stock": "https://schema.org/InStock",
  "sur commande": "https://schema.org/BackOrder",
  "bientôt disponible": "https://schema.org/OutOfStock",
  indisponible: "https://schema.org/OutOfStock",
};
export const AVAILABILITY_LABEL: Record<Availability, string> = {
  "en stock": "En stock",
  "sur commande": "Sur commande",
  "bientôt disponible": "Bientôt disponible",
  indisponible: "Indisponible",
};

/** Forme publique envoyée aux composants client (pas de champs internes). */
export type PublicProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  price?: number;
  image: string | null;
  cat: CategoryKey;
  availability: Availability;
  orderable: boolean;
  variantGroup: string | null;
  variantLabel: string | null;
  catSlug: string;
  compareAt?: number | null;
  badges: PublicBadge[];
  /** Hauteur vérifiée des portes coupe-feu, déjà formatée (ex. « 212,5 cm »). */
  height?: string | null;
};
const PRICE_BADGE = /%|\bDH\b|\bMAD\b|\d\s*%/i;
export function publicBadges(badges: PublicBadge[] | undefined, showPrices: boolean): PublicBadge[] {
  const list = badges ?? [];
  return showPrices ? list : list.filter((b) => !PRICE_BADGE.test(b.label));
}
export function toPublic(p: Product, showPrices = false): PublicProduct {
  const base: PublicProduct = {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    image: p.image,
    cat: categoryKey(p),
    availability: effectiveAvailability(p),
    orderable: canOrder(p),
    variantGroup: p.variantGroup,
    variantLabel: p.variantLabel,
    catSlug: p.catSlug ?? categoryKey(p),
    badges: publicBadges(p.badgeList, showPrices),
    height: doorHeight(p),
  };
  if (showPrices) {
    base.price = p.price;
    base.compareAt = p.compareAt ?? null;
  }
  return base;
}

export type GalleryImage = { src: string; alt: string; caption?: string; illustration?: boolean };

export function gallery(p: Product): GalleryImage[] {
  const out: GalleryImage[] = [];
  const cat = categoryKey(p);
  if (p.image) {
    out.push({
      src: p.image,
      alt: `${p.title}, vue produit – FAW Aluminium Casablanca`,
      caption:
        cat === "portes-coupe-feu"
          ? /-echelle\.\w+$/.test(p.image)
            ? "Visuel à l'échelle réalisé à partir d'une photo FAW · illustration non contractuelle"
            : "Photo FAW détourée · illustration non contractuelle"
          : cat === "galandage"
            ? "Photo d'ambiance : châssis prévu pour cloison placo · illustration non contractuelle"
            : "Photo détourée · illustration non contractuelle",
    });
  }
  if (cat === "portes-coupe-feu") {
    const two = /2 vantaux|-2V$/.test(`${p.variantLabel ?? ""} ${p.id}`);
    if (two) out.push({ src: "/images/alt/v6/CF-EI60-2V-photo-02.jpg", alt: `${p.title} – autre vue`, caption: "Photo FAW détourée, porte 2 vantaux · illustration non contractuelle" });
    out.push({
      src: two ? "/images/alt/CF-EI60-2V-illustration.png" : "/images/alt/CF-EI60-1V-illustration.png",
      alt: `${p.title} – illustration`,
      caption: "Illustration non contractuelle : barre anti-panique et ferme-porte en option",
      illustration: true,
    });
  }
  if (cat === "automatisme") {
    out.push({
      src: "/images/alt/AUTO-GBAT300-illustration.png",
      alt: `${p.title} – illustration sur portail`,
      caption: "Illustration non contractuelle",
      illustration: true,
    });
  }
  return out;
}

export type Spec = { label: string; value: string };

function m(re: RegExp, s: string) {
  return s.match(re)?.[1]?.trim();
}

/** Hauteur d'une porte coupe-feu, uniquement si elle figure déjà dans les données (attribut, détails ou description). */
export function doorHeight(p: Pick<Product, "attributes" | "description" | "details" | "category"> & { family?: CategoryKey; cat?: CategoryKey }): string | null {
  const cat = "family" in p && p.family ? p.family : "cat" in p && p.cat ? p.cat : categoryKey(p);
  if (cat !== "portes-coupe-feu") return null;
  try {
    const raw = String((JSON.parse(p.attributes || "{}") as Record<string, unknown>).hauteur ?? "").trim();
    if (raw) return /(?:cm|mm)\b/i.test(raw) ? raw.replace(".", ",") : `${raw.replace(".", ",")} cm`;
  } catch { /* attribut absent ou JSON invalide */ }
  const text = `${p.details ?? ""}\n${p.description ?? ""}`;
  const hit = text.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm/u);
  return hit ? `${hit[2].replace(".", ",")} cm` : null;
}

export function specs(p: Product): Spec[] {
  const d = p.description;
  const cat = categoryKey(p);
  const S: Spec[] = [{ label: "Référence", value: p.id }];
  if (cat === "portes-coupe-feu") {
    const dims = m(/Dimensions : (.+? cm),/, d);
    const leaves = m(/cm, (\d vantau?[xil]+)\./, d);
    S.push(
      { label: "Résistance au feu", value: "EI60" },
      { label: "Dimensions", value: dims ?? "" },
      { label: "Hauteur", value: doorHeight(p) ?? "" },
      { label: "Vantaux", value: leaves ?? "" },
      { label: "Structure", value: "Acier galvanisé, laine de roche" },
      { label: "Étanchéité", value: "Joint intumescent" },
      { label: "Finition", value: "Blanc (proche RAL 9018)" },
      { label: "Inclus", value: "Poignée, cylindre, serrure et clés" },
    );
  } else if (cat === "galandage") {
    S.push(
      { label: "Type", value: "Châssis à galandage, 1 vantail" },
      { label: "Passage", value: m(/Passage : ([^.]+)\./, d) ?? "" },
      { label: "Cloison", value: "Plaque de plâtre (placo)" },
      { label: "Contenu", value: "2 chariots, 1 frein ABS, 1 guide inférieur, rail" },
      { label: "Vantail (porte)", value: "Non inclus" },
    );
  } else if (cat === "automatisme") {
    S.push(
      { label: "Marque", value: "Genius, fabriqué en Italie" },
      { label: "Alimentation", value: "230V" },
      { label: "Portail", value: "Battant, 2 vantaux" },
      { label: "Charge max.", value: "350 kg par vantail" },
      { label: "Longueur", value: "Jusqu'à ~3 m par vantail" },
      { label: "Contenu", value: "2 vérins, armoire de commande, 2 télécommandes, lampe clignotante, photocellules, sélecteur à clé" },
      { label: "Serrure électrique", value: "Nécessaire au-delà de 2,50 m par vantail (prix sur demande)" },

    );
  } else {
    const cap = m(/(\d+\s?(?:kg|L|m))\b/, p.title);
    const classes = m(/\((classes? [^)]*?)(?:,| :|\))/, d);
    if (cap) S.push({ label: "Capacité", value: cap.replace(/(\d)(kg|L)/, "$1 $2") });
    if (classes) S.push({ label: "Classes de feu", value: classes.replace(/^classes? /, "") });
  }
  if (p.variantLabel && cat !== "portes-coupe-feu" && cat !== "incendie") S.push({ label: "Taille", value: p.variantLabel });
  S.push({ label: cat === "incendie" ? "Installation" : "Pose", value: "Non comprise" });
  S.push({ label: "Disponibilité", value: AVAILABILITY_LABEL[effectiveAvailability(p)] });
  return S.filter((s) => s.value);
}

/** Ligne de caractéristiques courte affichée sous le H1. */
export function specLine(p: Product): string {
  const cat = categoryKey(p);
  const d = p.description;
  if (cat === "portes-coupe-feu") {
    const dims = m(/Dimensions : (.+? cm),/, d);
    const leaves = m(/cm, (\d vantau?[xil]+)\./, d);
    const height = doorHeight(p);
    const heightBit = !dims && height ? `hauteur ${height}` : null;
    return [dims, heightBit, leaves, "EI60", "acier galvanisé", "laine de roche", "blanc"].filter(Boolean).join(" · ");
  }
  if (cat === "galandage") return [`Passage ${m(/Passage : ([^.]+)\./, d) ?? ""}`, "cloison placo", "châssis seul, vantail non inclus"].join(" · ");
  if (cat === "automatisme") return "230V · portail battant 2 vantaux · 350 kg max. par vantail · Genius, fabriqué en Italie";
  const cap = m(/(\d+\s?(?:kg|L|m))\b/, p.title);
  const classes = m(/\((classes? [^)]*?)(?:,| :|\))/, d);
  return [cap, classes, "installation non comprise"].filter(Boolean).join(" · ");
}

/** <title> ciblé (mot-clé + ville), 60 caractères max. */
export function seoPageTitle(p: Product): string {
  const cat = categoryKey(p);
  const fit = (s: string) => (s.length <= 60 ? s : null);
  const clean = p.title.replace(/\s+–\s+/g, " ").replace(/\s{2,}/g, " ").trim();
  let cands: string[];
  if (cat === "portes-coupe-feu") cands = [`${clean} – Casablanca`, clean];
  else if (cat === "galandage") {
    const w = m(/(\d+ cm)/, p.title);
    cands = [`Châssis galandage ${w}, porte coulissante – Casablanca`, `Châssis galandage ${w} – Casablanca`, clean];
  } else if (cat === "automatisme") cands = [`Kit moteur portail battant G-BAT 300 – Casablanca`, clean];
  else cands = [`${clean} – Casablanca`, clean];
  return cands.map(fit).find(Boolean) ?? clean.slice(0, 60);
}

export function seoDescription(p: Product, priceLabel: string): string {
  const cat = categoryKey(p);
  const tail =
    cat === "automatisme"
      ? "Expédition partout au Maroc. Pose non comprise."
      : "Pose non comprise, retrait gratuit au dépôt ou livraison. Devis PDF en ligne.";
  const s = priceLabel
    ? `${p.title} à ${priceLabel} chez FAW Aluminium, Casablanca. ${specLine(p)}. ${tail}`
    : `${p.title} chez FAW Aluminium, Casablanca. Prix sur devis. ${specLine(p)}. ${tail}`;
  return s.length <= 160 ? s : `${s.slice(0, 157).replace(/\s+\S*$/, "")}…`;
}

/** Paragraphe descriptif (SEO) : texte factuel issu des données produit, sans promesse de délai. */
export function seoParagraph(p: Product): string {
  const cat = categoryKey(p);
  if (cat === "portes-coupe-feu")
    return `Cette porte coupe-feu EI60 (${specLine(p)}) est disponible au dépôt FAW de Casablanca. Elle convient aux locaux techniques, parkings, cages d'escalier et logements. Fourniture seule : la pose n'est pas comprise. Prix sur devis. Vous pouvez la retirer gratuitement au dépôt ou demander la livraison.`;
  if (cat === "galandage")
    return `Ce châssis pour porte coulissante à galandage s'intègre dans une cloison en plaque de plâtre (placo) pour gagner de la place : la porte disparaît dans la cloison. Le châssis et sa quincaillerie sont proposés sur devis ; le vantail et la pose ne sont pas compris.`;
  if (cat === "automatisme")
    return `Le kit G-BAT 300 (Genius, fabriqué en Italie) motorise un portail battant à deux vantaux jusqu'à 350 kg par vantail. Il est livré complet avec vérins, armoire de commande, télécommandes, lampe et photocellules. Fourniture seule, pose non comprise ; conditions de garantie à confirmer.`;
  return `${p.title} disponible chez FAW Aluminium à Casablanca, prix sur devis. ${p.description.split(". ")[0]}. L'installation et la vérification sur site ne sont pas comprises.`;
}

export type Faq = { q: string; a: string };

export function productFaq(p: Product, priceLabel: string): Faq[] {
  const cat = categoryKey(p);
  const faq: Faq[] = [
    { q: `Quel est le prix ${cat === "incendie" ? "de cet article" : "de ce produit"} ?`, a: priceLabel ? `${priceLabel}, prix TTC (TVA 20 % incluse). Fourniture seule : la pose n'est pas comprise.` : "Prix sur devis. L'équipe FAW vous envoie le devis PDF après validation de votre demande. Fourniture seule : la pose n'est pas comprise." },
  ];
  if (cat === "portes-coupe-feu") {
    faq.push({ q: "Combien coûte la livraison ?", a: priceLabel ? "Casablanca : 400 DH, Rabat : 800 DH, autres villes : à confirmer. Retrait gratuit au dépôt. Le transport des portes est facturé une seule fois par commande." : "Le transport est confirmé sur le devis. Retrait gratuit au dépôt. Le transport des portes est facturé une seule fois par commande." });
    if (["CF-EI60-80", "CF-EI60-90", "CF-EI60-100"].includes(p.id))
      if (priceLabel) faq.push({ q: "Y a-t-il un prix par quantité ?", a: "Oui : à partir de 4 portes 1 vantail de 80, 90 ou 100 cm (tailles mélangées), le prix passe à 2 000 DH TTC la porte." });
  } else if (cat === "automatisme") {
    faq.push({ q: "Livrez-vous partout au Maroc ?", a: "Oui, le kit est expédié par transporteur ; les frais selon la ville sont payés à la réception." });
  } else {
    faq.push({ q: "Comment se passe la livraison ?", a: "Livraison sur devis selon la ville, ou retrait au dépôt (adresse à confirmer)." });
  }
  faq.push(
    { q: "Comment obtenir un devis ?", a: "Remplissez le formulaire de devis : l'équipe FAW valide votre demande et vous envoie le PDF, valable 14 jours, avec le total HT et TTC." },
    { q: "Quels moyens de paiement acceptez-vous ?", a: "Virement bancaire ou chèque. Pas de paiement par carte, ni de crédit." },
  );
  return faq;
}

export type DeliveryInfo = { title: string; lines: string[] };

export function deliveryInfo(cat: CategoryKey): DeliveryInfo {
  switch (cat) {
    case "portes-coupe-feu":
      return {
        title: "Livraison des portes",
        lines: [
          "Casablanca et Rabat : transport à confirmer sur devis",
          "Autres villes : sur devis",
          "Retrait gratuit au dépôt : adresse à confirmer",
          "Transport facturé une seule fois par commande",
          "Pose non comprise",
        ],
      };
    case "automatisme":
      return {
        title: "Livraison du kit",
        lines: [
          "Partout au Maroc par transporteur",
          "Frais de transport selon la ville, payés à la réception",
          "Fourniture seule, pose non comprise",
          "Conditions de garantie à confirmer",
        ],
      };
    default:
      return {
        title: "Livraison",
        lines: [
          "Livraison : sur devis",
          "Retrait au dépôt : adresse à confirmer",
          cat === "incendie" ? "Installation non comprise" : "Pose non comprise",
        ],
      };
  }
}

/** Options & tarifs complémentaires (grille FAW), affichés à titre d'information. */
export function doorOptions(p: Product, showPrices = false): string[] | null {
  if (categoryKey(p) !== "portes-coupe-feu") return null;
  const lines: string[] = [];
  if (showPrices) {
    if (["CF-EI60-80", "CF-EI60-90", "CF-EI60-100"].includes(p.id))
      lines.push("Prix dégressif dès 4 portes (80/90/100 cm) : 2 000 DH TTC la porte, appliqué à la confirmation");
    lines.push(
      /2 vantaux|-2V$/.test(`${p.variantLabel ?? ""} ${p.id}`) ? "Barre anti-panique 2 vantaux : 2 200 DH TTC" : "Barre anti-panique 1 vantail : 900 DH TTC",
      "Ferme-porte : 250 DH TTC",
    );
  } else {
    lines.push("Barre anti-panique et ferme-porte : options, prix sur devis");
  }
  lines.push("Certificats de résistance au feu et de conformité disponibles sur demande");
  return lines;
}

/** Libellé de variante → [taille, section] (ex. « 120 cm · 2 vantaux »). */
export function splitVariantLabel(label: string | null): [string, string] {
  const [a, b] = (label ?? "").split(" · ");
  return [a ?? "", b ?? ""];
}

/** Lien public d'un article du panier (fiche produit ou section du pack). */
export function itemHref(p: { id: string; slug: string }) {
  return p.id.startsWith("pack:") ? `/packs#${p.id.slice(5)}` : `/produits/${p.slug}`;
}

/** Paragraphes « Détails » : texte du back-office, sinon paragraphe factuel généré. */
export function detailParagraphs(p: Product): string[] {
  const src = p.details?.trim();
  if (src) return src.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  return [seoParagraph(p)];
}

/** Étapes du guide d'installation saisies au back-office (une par ligne). */
export function installSteps(p: Product): string[] {
  return (p.installationGuide ?? "").split(/\n/).map((x) => x.replace(/^\s*(?:\d+[.)]|[-•])\s*/, "").trim()).filter(Boolean);
}

/** Points à vérifier avant la pose : uniquement des faits déjà présents dans la fiche (aucune consigne technique inventée). */
export function installChecks(p: Product): string[] {
  const d = p.description;
  const cat = categoryKey(p);
  if (cat === "portes-coupe-feu") {
    const dims = m(/Dimensions : (.+? cm),/, d);
    const leaves = m(/cm, (\d vantau?[xil]+)\./, d);
    return [
      dims ? `Mesurez l'ouverture prévue : la porte fait ${dims}${leaves ? `, ${leaves}` : ""}.` : "",
      "Poignée, cylindre, serrure et clés sont fournis.",
      `Barre anti-panique et ferme-porte : en option, à ajouter à la commande si besoin.`,
      "La pose n'est pas comprise : prévoyez un poseur qualifié.",
    ].filter(Boolean);
  }
  if (cat === "galandage") {
    const pass = m(/Passage : ([^.]+)\./, d);
    return [
      "Châssis prévu pour une cloison en plaque de plâtre (placo).",
      pass ? `Passage : ${pass}.` : "",
      "À la réception, vérifiez le contenu : 2 chariots, 1 frein ABS, 1 guide inférieur et le rail.",
      "Le vantail (la porte) n'est pas inclus : prévoyez-le à part.",
      "La pose n'est pas comprise.",
    ].filter(Boolean);
  }
  if (cat === "automatisme") {
    return [
      "Pour portail battant 2 vantaux : 350 kg maximum et environ 3 m maximum par vantail.",
      "Au-delà de 2,50 m par vantail, une serrure électrique est nécessaire (prix sur demande).",
      "Alimentation 230V.",
      "À la réception, vérifiez le contenu : 2 vérins, armoire de commande, 2 télécommandes, lampe clignotante, photocellules, sélecteur à clé.",
      "La pose n'est pas comprise.",
    ];
  }
  const classes = m(/\((classes? [^)]*?)(?:,| :|\))/, d);
  return [
    classes ? `Vérifiez que l'appareil correspond aux feux à couvrir (${classes}).` : "",
    "L'installation et la vérification sur site ne sont pas comprises.",
  ].filter(Boolean);
}
