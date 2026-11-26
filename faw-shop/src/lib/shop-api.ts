import "server-only";
import { z } from "zod";
import { QUOTE_TOKEN_RE } from "./devis";

// Lectures privées / ponctuelles de la boutique via l'API Laravel (/api/shop/*). Aucun accès direct à la base.
const origin = () => process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";

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

export async function shopLanding(slug: string): Promise<ShopLanding | null> {
  if (!LANDING_SLUG.test(slug) || slug.length > 60) return null;
  const v = landingSchema.safeParse(await getJson(`/api/shop/landings/${slug}`, 5000));
  return v.success ? v.data : null;
}

export async function shopLandings(): Promise<{ slug: string; updatedAt: string | null }[]> {
  const v = z.array(z.object({ slug: z.string(), updatedAt: z.string().nullable() })).safeParse(await getJson("/api/shop/landings", 5000));
  return v.success ? v.data : [];
}
