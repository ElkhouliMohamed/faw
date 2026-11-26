import "server-only";
import { cache } from "react";
import { z } from "zod";
import { categoryOf, csv, familyOf, merch, type Merch } from "./merch";
import { AVAILABILITIES, type Product, categoryKey, type CategoryKey, toPublic, type PublicProduct } from "./products";
import { showPublicPrices } from "./price-visibility";

/** Enrichit un produit : catégorie, famille et badges. Le prix actif (promotion en cours, prix barré) est calculé par Laravel. */
function decorate(p: Product, m: Merch): Product {
  const cat = categoryOf(m, p.category);
  const ids = csv(p.badges);
  const badgeList = m.badges.filter((b) => ids.includes(String(b.id))).map((b) => ({ label: b.label, tone: b.tone }));
  return { ...p, basePrice: p.basePrice ?? p.price, compareAt: p.compareAt ?? null, promoName: p.promoName ?? null, catSlug: cat?.slug ?? undefined, family: familyOf(m, p.category), badgeList };
}

/** Produits publiés du catalogue, prix actif (promotions appliquées par Laravel ; absent si les prix publics sont masqués). */
export async function allProducts(): Promise<Product[]> {
  const [m, list] = await Promise.all([merch(), baseProducts()]);
  return list.map((p) => decorate(p, m));
}
const apiProduct = z.object({
  id: z.string(), slug: z.string(), title: z.string(), seoTitle: z.string(), description: z.string(),
  shortDescription: z.string().nullable(), price: z.number().int().optional(), category: z.string(), brand: z.string(), image: z.string().nullable(),
  availability: z.enum(AVAILABILITIES), stockQty: z.number().nullable(), priceToConfirm: z.boolean(), stockToConfirm: z.boolean(),
  stockNote: z.string().nullable(), variantGroup: z.string().nullable(), variantLabel: z.string().nullable(), sortOrder: z.number(), active: z.boolean(),
  basePrice: z.number().int().optional(), compareAt: z.number().int().nullable().optional(), promoName: z.string().nullable().optional(), orderable: z.boolean().optional(), badges: z.string().optional(), warrantyId: z.number().nullable().optional(),
  updatedAt: z.string().nullable().optional(), metaTitle: z.string().optional(), metaDescription: z.string().optional(), h1: z.string().optional(), attributes: z.string().optional(),
  details: z.string().nullable().optional(), installationGuide: z.string().nullable().optional(),
  datasheet: z.string().regex(/^\/storage\/fiches-techniques\/[a-zA-Z0-9_.-]+\.pdf$/).nullable().optional().catch(null),
  maintenanceGuide: z.string().regex(/^\/storage\/guides-pose-entretien\/[a-zA-Z0-9_.-]+\.pdf$/).nullable().optional().catch(null),
});
/** Un seul appel API par rendu (React cache) : la limite Laravel du catalogue est partagée par tous les visiteurs (127.0.0.1). */
const baseProducts = cache(async function baseProducts(): Promise<Product[]> {
  const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
  const response = await fetch(`${origin}/api/catalog`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Catalogue temporairement indisponible");
  return apiProduct.array().parse(await response.json()).map(({ updatedAt, ...p }) => ({ ...p, price: p.price ?? p.basePrice ?? 0, orderable: p.orderable, updatedAt: updatedAt ? new Date(updatedAt) : undefined }));
});
export async function getProduct(slug: string) {
  return (await allProducts()).find((p) => p.slug === slug.toLowerCase());
}
export async function getProductById(id: string) {
  return (await allProducts()).find((p) => p.id === id);
}
export async function publicCatalog(): Promise<PublicProduct[]> {
  const show = await showPublicPrices();
  return (await allProducts()).map((p) => toPublic(p, show));
}
export async function productsInCategory(key: CategoryKey) {
  return (await allProducts()).filter((p) => categoryKey(p) === key);
}
/** Fiches sœurs (même groupe de variantes), produit courant inclus. */
export async function variantSiblings(p: Product) {
  if (!p.variantGroup) return [];
  return (await allProducts()).filter((x) => x.variantGroup === p.variantGroup);
}
