import "server-only";
import { cache } from "react";
import { prisma } from "./db";
import { CATEGORIES, CATEGORIES as STATIC_CATS, canOrder as canOrderP, type CategoryKey, type Product as P } from "./products";
import type { PublicCategory, PublicPack, ShopConfig } from "./shop-config";
import { type ShippingConfig } from "./delivery";

// Données « merchandising » éditées au back-office (catégories, badges, promos, packs, livraison…).
// Cache partagé (globalThis) invalidé à chaque écriture admin ; les pages publiques sont aussi revalidées.

export type CategoryRow = Awaited<ReturnType<typeof prisma.category.findMany>>[number];
export type BadgeRow = Awaited<ReturnType<typeof prisma.badge.findMany>>[number];
export type WarrantyRow = Awaited<ReturnType<typeof prisma.warranty.findMany>>[number];
export type AttributeRow = Awaited<ReturnType<typeof prisma.attribute.findMany>>[number];
export type PromotionRow = Awaited<ReturnType<typeof prisma.promotion.findMany>>[number];
export type BundleRow = Awaited<ReturnType<typeof prisma.bundle.findMany>>[number];
export type PopupRow = Awaited<ReturnType<typeof prisma.popup.findMany>>[number];

export type Merch = {
  at: number;
  categories: CategoryRow[];
  badges: BadgeRow[];
  warranties: WarrantyRow[];
  attributes: AttributeRow[];
  promotions: PromotionRow[];
  bundles: BundleRow[];
  popups: PopupRow[];
  shipping: ShippingConfig;
};

const store = globalThis as unknown as { __fawMerch?: Merch | null; __fawMerchSeed?: Promise<void> | null; __fawMerchGen?: number };
const TTL = 0;

export const merch = cache(async function merch(): Promise<Merch> {
  const c = store.__fawMerch;
  if (c && Date.now() - c.at < TTL) return c;
  // Schema and default categories are now owned by Laravel.
  // Génération : un chargement commencé avant une modification ne doit pas réécrire le cache après l'invalidation.
  const gen = store.__fawMerchGen ?? 0;
  const order = [{ sortOrder: "asc" as const }, { id: "asc" as const }];
  const [categories, badges, warranties, attributes, promotions, bundles, popups, cities, rules] = await Promise.all([
    prisma.category.findMany({ orderBy: order }),
    prisma.badge.findMany({ where: { active: true }, orderBy: order }),
    prisma.warranty.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.attribute.findMany({ where: { active: true }, orderBy: order }),
    prisma.promotion.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.bundle.findMany({ where: { active: true }, orderBy: order }),
    prisma.popup.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.shippingCity.findMany({ where: { active: true }, orderBy: order }),
    prisma.feeRule.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
  ]);
  const m: Merch = {
    at: Date.now(),
    categories,
    badges,
    warranties,
    attributes,
    promotions,
    bundles,
    popups,
    shipping: {
      cities: cities.map((x) => ({ slug: x.slug, name: x.name, fee: x.fee, available: x.available, delayText: x.delayText })),
      rules: rules.map((r) => ({ scope: r.scope === "category" ? "category" : "product", target: r.target, city: r.citySlug, mode: r.mode === "devis" ? "devis" : "fixed", fee: r.fee })),
    },
  };
  if ((store.__fawMerchGen ?? 0) === gen) store.__fawMerch = m;
  return m;
});
export function invalidateMerch() {
  store.__fawMerchGen = (store.__fawMerchGen ?? 0) + 1;
  store.__fawMerch = null;
}

export const isLive = (x: { startsAt: Date | null; endsAt: Date | null }, now = Date.now()) =>
  (!x.startsAt || x.startsAt.getTime() <= now) && (!x.endsAt || x.endsAt.getTime() > now);

export const csv = (s: string | null | undefined) => (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);

/** Catégorie DB d'un produit (par libellé) ; famille de repli « incendie » comme avant. */
export function categoryOf(m: Merch, label: string) {
  return m.categories.find((c) => c.label === label) ?? null;
}
export function familyOf(m: Merch, label: string): CategoryKey {
  const f = categoryOf(m, label)?.family;
  return (CATEGORIES.some((c) => c.key === f) ? f : CATEGORIES.find((c) => c.label === label)?.key ?? "incendie") as CategoryKey;
}

/** Prix actif après promotions en cours (la meilleure pour le client), jamais sous 1 DH. */
export function promoPrice(m: Merch, p: { id: string; price: number; category: string }, now = Date.now()) {
  if (p.price <= 0) return null;
  const slug = categoryOf(m, p.category)?.slug;
  let best: { price: number; name: string } | null = null;
  for (const pr of m.promotions) {
    if (!isLive(pr, now) || pr.value <= 0) continue;
    const t = csv(pr.targets);
    const hit = pr.scope === "all" || (pr.scope === "product" && t.includes(p.id)) || (pr.scope === "category" && !!slug && t.includes(slug));
    if (!hit) continue;
    const price = Math.max(1, pr.kind === "percent" ? Math.round((p.price * (100 - Math.min(pr.value, 90))) / 100) : p.price - pr.value);
    if (price < p.price && (!best || price < best.price)) best = { price, name: pr.name };
  }
  return best;
}

export type BundleItem = { id: string; qty: number };
export function bundleItems(b: { items: string }): BundleItem[] {
  try {
    const v = JSON.parse(b.items) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((x) => ({ id: String((x as BundleItem).id ?? ""), qty: Math.max(1, Math.min(99, Math.trunc(Number((x as BundleItem).qty) || 1))) }))
      .filter((x) => x.id);
  } catch {
    return [];
  }
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
    const items = bundleItems(b);
    const comps = items.map((it) => ({ it, p: products.find((x) => x.id === it.id) }));
    if (!comps.length || comps.some((c) => !c.p)) continue;
    const first = comps[0].p!;
    const sum = comps.reduce((s, c) => s + c.p!.price * c.it.qty, 0);
    const orderable = comps.every((c) => canOrderP(c.p!)) && b.price > 0;
    out.push({
      slug: b.slug,
      title: b.title,
      description: b.description,
      image: b.image ?? first.image,
      price: b.price,
      compareAt: sum,
      items: comps.map((c) => ({ id: c.it.id, qty: c.it.qty, title: c.p!.title })),
      product: {
        id: `pack:${b.slug}`,
        slug: `packs#${b.slug}`,
        title: `Pack ${b.title}`,
        description: b.description,
        price: b.price,
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

/** Garanties distinctes applicables aux lignes d'un devis (vide tant qu'aucune garantie n'est saisie). */
export async function warrantiesForIds(ids: string[]): Promise<{ name: string; text: string }[]> {
  const m = await merch();
  if (!m.warranties.length || !ids.length) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: [...new Set(ids)].slice(0, 100) } }, select: { warrantyId: true, category: true } });
  const out = new Map<string, { name: string; text: string }>();
  for (const r of rows) {
    const w = warrantyFor(m, r);
    if (w) out.set(w.name + "\n" + w.text, w);
  }
  return [...out.values()];
}
