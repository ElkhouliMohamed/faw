import "server-only";
import { cache } from "react";
import { z } from "zod";
import { CATEGORIES, CATEGORIES as STATIC_CATS, canOrder as canOrderP, type CategoryKey, type Product as P } from "./products";
import type { PublicCategory, PublicPack, ShopConfig } from "./shop-config";
import type { ShippingConfig } from "./delivery";
import type { PublicPopup } from "@/components/popups";
import { publicJson } from "./shop-api";

// Données « merchandising » éditées dans Filament (catégories, badges, garanties, attributs, packs, popups, livraison).
// Lues par l'API Laravel (/api/shop/merch) : la boutique n'accède jamais directement à la base.
// Laravel masque déjà les montants (packs, frais de livraison) quand les prix publics sont désactivés.

const str = z.string().nullable().optional().transform((v) => v ?? "");
const categorySchema = z.object({
  id: z.number(), parentId: z.number().nullable(), slug: z.string(), label: z.string(), short: str, family: str, description: str,
  image: z.string().nullable(), seoTitle: str, seoDescription: str, h1: str, active: z.boolean(), warrantyId: z.number().nullable(),
});
const merchSchema = z.object({
  showPrices: z.boolean(),
  categories: z.array(categorySchema),
  badges: z.array(z.object({ id: z.number(), label: z.string(), tone: z.string() })),
  warranties: z.array(z.object({ id: z.number(), name: z.string(), text: z.string() })),
  attributes: z.array(z.object({ key: z.string(), label: z.string(), unit: str, showInSpecs: z.boolean() })),
  bundles: z.array(z.object({
    slug: z.string(), title: z.string(), description: str, image: z.string().nullable(), price: z.number().nullable(), orderable: z.boolean(),
    items: z.array(z.object({ id: z.string(), qty: z.number().int() })),
  })),
  popups: z.array(z.object({
    id: z.number(), v: z.string(), kind: z.enum(["promo", "newsletter", "whatsapp"]), title: z.string(), body: z.string(), ctaLabel: z.string(), ctaUrl: z.string(),
    trigger: z.enum(["delay", "scroll", "exit"]), delaySeconds: z.number(), scrollPercent: z.number(), paths: z.array(z.string()),
    frequency: z.enum(["once", "session", "days"]), frequencyDays: z.number(),
  })),
  shipping: z.object({
    cities: z.array(z.object({ slug: z.string(), name: z.string(), fee: z.number().nullable(), available: z.boolean(), delayText: str })),
    rules: z.array(z.object({ scope: z.enum(["product", "category"]), target: z.string(), city: z.string(), mode: z.enum(["fixed", "devis"]), fee: z.number().nullable() })),
  }),
});

export type CategoryRow = z.infer<typeof categorySchema>;
export type BundleRow = z.infer<typeof merchSchema>["bundles"][number];
export type Merch = Omit<z.infer<typeof merchSchema>, "popups" | "shipping"> & { popups: PublicPopup[]; shipping: ShippingConfig };

/**
 * Un seul appel par rendu (React cache) ; la réponse est en cache Next (étiquette "merch", 120 s max),
 * vidée par Laravel dès qu'une catégorie, un pack, un popup ou un tarif de livraison change dans Filament.
 */
export const merch = cache(async function merch(): Promise<Merch> {
  const data = await publicJson("/api/shop/merch", "merch", 10000);
  if (data == null) throw new Error("Données boutique temporairement indisponibles");
  return merchSchema.parse(data);
});

export const csv = (s: string | null | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Catégorie d'un produit (par libellé) ; famille de repli « incendie » comme avant. */
export function categoryOf(m: Merch, label: string) {
  return m.categories.find((c) => c.label === label) ?? null;
}
export function familyOf(m: Merch, label: string): CategoryKey {
  const f = categoryOf(m, label)?.family;
  return (CATEGORIES.some((c) => c.key === f) ? f : CATEGORIES.find((c) => c.label === label)?.key ?? "incendie") as CategoryKey;
}

export function parseAttributes(s: string | null | undefined): Record<string, string> {
  try {
    const v = JSON.parse(s || "{}") as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, String(x ?? "")]).filter(([, x]) => x));
  } catch {
    return {};
  }
}

/** Garantie affichée : celle du produit, sinon celle de sa catégorie (aucune par défaut). */
export function warrantyFor(m: Merch, p: { warrantyId?: number | null; category: string }) {
  const id = p.warrantyId ?? categoryOf(m, p.category)?.warrantyId ?? null;
  const w = id != null ? m.warranties.find((x) => x.id === id) : undefined;
  return w && w.text.trim() ? { name: w.name, text: w.text.trim() } : null;
}

/** Lignes de caractéristiques issues des attributs réutilisables du back-office. */
export function attributeSpecs(m: Merch, p: { attributes?: string | null }) {
  const vals = parseAttributes(p.attributes);
  return m.attributes
    .filter((a) => a.showInSpecs && vals[a.key])
    .map((a) => ({ label: a.label, value: a.unit ? `${vals[a.key]} ${a.unit}` : vals[a.key] }));
}

/** Ligne tarifaire des villes livrées (Villes de livraison), ex. « Casablanca : 400 DH · Rabat : 800 DH ». */
export function cityFeesLine(m: Merch, showPrices = true) {
  if (!showPrices) return "Transport à confirmer sur devis · Retrait gratuit au dépôt";
  return m.shipping.cities
    .filter((c) => c.available && c.fee != null && c.fee > 0)
    .map((c) => `${c.name} : ${c.fee} DH`)
    .join(" · ");
}

/* ----------------------- Configuration publique ----------------------- */

export function publicCategories(m: Merch): PublicCategory[] {
  const byId = new Map(m.categories.map((c) => [c.id, c]));
  const published = (id: number, depth = 0): boolean => {
    const c = byId.get(id);
    return !!c && c.active && depth < 8 && (c.parentId == null || published(c.parentId, depth + 1));
  };
  return m.categories
    .filter((c) => published(c.id))
    .map((c) => {
      const fam = (STATIC_CATS.some((x) => x.key === c.family) ? c.family : "incendie") as CategoryKey;
      // URL propre : page historique pour les familles racines, sinon /produits/<slug> (voir category-tree.ts).
      const page = c.parentId == null ? STATIC_CATS.find((x) => x.key === c.slug)?.page : undefined;
      return { slug: c.slug, label: c.label, short: c.short || c.label, family: fam, image: c.image, href: page ?? `/produits/${encodeURIComponent(c.slug)}` };
    });
}

export function publicPacks(m: Merch, products: P[]): PublicPack[] {
  const out: PublicPack[] = [];
  for (const b of m.bundles) {
    const comps = b.items.map((it) => ({ it, p: products.find((x) => x.id === it.id) }));
    if (!comps.length || comps.some((c) => !c.p)) continue;
    const first = comps[0].p!;
    const price = b.price ?? 0;
    const sum = comps.reduce((s, c) => s + c.p!.price * c.it.qty, 0);
    const orderable = comps.every((c) => canOrderP(c.p!)) && b.orderable;
    out.push({
      slug: b.slug,
      title: b.title,
      description: b.description,
      image: b.image ?? first.image,
      price,
      compareAt: sum,
      items: comps.map((c) => ({ id: c.it.id, qty: c.it.qty, title: c.p!.title })),
      product: {
        id: `pack:${b.slug}`,
        slug: `packs#${b.slug}`,
        title: `Pack ${b.title}`,
        description: b.description,
        price,
        image: b.image ?? first.image,
        cat: familyOf(m, first.category),
        catSlug: "packs",
        availability: orderable ? "en stock" : "indisponible",
        orderable,
        variantGroup: null,
        variantLabel: null,
        compareAt: null,
        badges: [],
      },
    });
  }
  return out;
}

export async function shopConfig(products: P[], showPrices = false): Promise<ShopConfig> {
  const m = await merch();
  const shipping = showPrices
    ? m.shipping
    : {
        ...m.shipping,
        cities: m.shipping.cities.map((c) => ({ ...c, fee: null })),
        rules: m.shipping.rules.map((r) => ({ ...r, fee: null, mode: "devis" as const })),
      };
  const packs = publicPacks(m, products).map((b) =>
    showPrices ? b : { ...b, price: undefined, compareAt: undefined, product: { ...b.product, price: undefined, compareAt: null } },
  );
  return { showPrices, shipping, categories: publicCategories(m), packs };
}
