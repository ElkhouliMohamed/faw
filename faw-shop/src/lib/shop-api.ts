import "server-only";
import { cache } from "react";
import { z } from "zod";
import { QUOTE_TOKEN_RE } from "./devis";

// Lectures de la boutique via l'API Laravel. Aucun accès direct à la base.
// - Données publiques (catalogue, merchandising, contenu, menus, réglages) : cache de données Next (revalidate + tags),
//   vidé à la demande par Laravel (POST /revalidate, voir src/app/revalidate/route.ts) dès qu'une fiche change dans Filament.
// - Données privées (devis, commandes, panier, portail) : jamais en cache (cache: "no-store").
export const laravelOrigin = () => process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
const origin = laravelOrigin;

/** Étiquettes de cache partagées avec Laravel (App\Services\StorefrontCache::TAGS). */
export const CACHE_TAGS = ["catalog", "merch", "content", "home", "site", "config", "landings", "redirects"] as const;
export type CacheTag = (typeof CACHE_TAGS)[number];

/**
 * Durées de fraîcheur maximales (secondes) quand le webhook n'a pas pu prévenir la boutique.
 * Le catalogue reste court : une promotion programmée commence ou finit sans modification dans Filament.
 */
export const REVALIDATE: Record<CacheTag, number> = { catalog: 120, merch: 120, content: 300, home: 300, site: 300, config: 120, landings: 300, redirects: 60 };

/**
 * GET JSON public, mis en cache par Next (Data Cache) avec revalidation par durée et par étiquette.
 * Renvoie null si l'API est indisponible ou répond autre chose que 2xx (une erreur n'est jamais mise en cache).
 */
export async function publicJson(path: string, tag: CacheTag, timeout = 8000): Promise<unknown | null> {
  try {
    const r = await fetch(`${origin()}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE[tag], tags: [tag, "faw"] },
      signal: AbortSignal.timeout(timeout),
    });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** GET JSON privé : jamais mis en cache (liens de devis, confirmations de commande). */
async function getJson(path: string, timeout = 8000): Promise<unknown | null> {
  const r = await fetch(`${origin()}${path}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(timeout) }).catch(() => null);
  if (!r?.ok) return null;
  return r.json().catch(() => null);
}

/* ------------------------------ Devis (lien privé) ------------------------------ */
const quoteSchema = z.object({
  status: z.string(),
  ready: z.boolean(),
  number: z.string().nullable(),
  versionNumber: z.string().nullable(),
  clientName: z.string(),
  createdAt: z.string().nullable(),
  transport: z.string(),
  totalHt: z.number().nullable(),
  totalTtc: z.number().nullable(),
  lines: z.array(z.object({ id: z.string(), title: z.string(), qty: z.number(), unit: z.number().optional(), total: z.number().optional(), tier: z.boolean().optional() })),
  warranties: z.array(z.object({ name: z.string(), text: z.string() })),
});
export type ShopQuote = z.infer<typeof quoteSchema>;

/** Devis du lien privé actif (format vérifié, lien non révoqué ni expiré côté Laravel), sinon null. */
export async function shopQuote(token: string): Promise<ShopQuote | null> {
  if (!QUOTE_TOKEN_RE.test(token)) return null;
  const v = quoteSchema.safeParse(await getJson(`/api/shop/quotes/${token}`));
  return v.success ? v.data : null;
}

/* ------------------------------ Confirmation de commande ------------------------------ */
export const ORDER_NUMBER_RE = /^FAW-\d{6}-[0-9A-F]{32}$/;
const orderSchema = z.object({
  number: z.string(),
  customerName: z.string(),
  city: z.string(),
  deliveryMode: z.string(),
  deliveryFee: z.number(),
  deliveryNote: z.string().nullable(),
  paymentMethod: z.string(),
  total: z.number(),
  items: z.array(z.object({ id: z.number(), productId: z.string(), title: z.string(), quantity: z.number(), lineTotal: z.number() })),
});
export type ShopOrder = z.infer<typeof orderSchema>;

export async function shopOrder(number: string): Promise<ShopOrder | null> {
  if (!ORDER_NUMBER_RE.test(number)) return null;
  const v = orderSchema.safeParse(await getJson(`/api/shop/orders/${number}`));
  return v.success ? v.data : null;
}

/* ------------------------------ Landing pages ------------------------------ */
const LANDING_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const landingSchema = z.object({
  slug: z.string(),
  title: z.string(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  blocks: z.array(z.unknown()),
  updatedAt: z.string().nullable(),
});
export type ShopLanding = z.infer<typeof landingSchema>;

/** Landing page publiée (un seul appel par rendu : métadonnées + page). */
export const shopLanding = cache(async function shopLanding(slug: string): Promise<ShopLanding | null> {
  if (!LANDING_SLUG.test(slug) || slug.length > 60) return null;
  const v = landingSchema.safeParse(await publicJson(`/api/shop/landings/${slug}`, "landings", 5000));
  return v.success ? v.data : null;
});

export async function shopLandings(): Promise<{ slug: string; updatedAt: string | null }[]> {
  const v = z.array(z.object({ slug: z.string(), updatedAt: z.string().nullable() })).safeParse(await publicJson("/api/shop/landings", "landings", 5000));
  return v.success ? v.data : [];
}
