import "server-only";
import { prisma } from "./db";
import { allProducts } from "./catalog";
import { bundleItems, isLive, merch } from "./merch";
import { canOrder, categoryKey, type Product } from "./products";
import type { CartItemCtx } from "./delivery";

// Prix serveur d'un panier (produits + packs). Les prix client ne sont jamais utilisés.
export const PACK_PREFIX = "pack:";

export type PricedLine = {
  id: string;
  kind: "product" | "pack";
  title: string;
  category: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
  /** Produits réels (le pack est déplié pour le stock, la livraison et le devis). */
  components: { p: Product; qty: number }[];
};

export async function priceItems(items: { id: string; qty: number }[]): Promise<{ lines: PricedLine[]; error?: string }> {
  const all = await allProducts();
  const m = await merch();
  const byId = new Map(all.map((p) => [p.id, p]));
  const lines: PricedLine[] = [];
  const need = new Map<string, number>();
  for (const it of items) {
    if (it.id.startsWith(PACK_PREFIX)) {
      const b = m.bundles.find((x) => x.slug === it.id.slice(PACK_PREFIX.length));
      if (!b) return { lines, error: "Pack inconnu ou plus disponible" };
      const comps: { p: Product; qty: number }[] = [];
      for (const c of bundleItems(b)) {
        const p = byId.get(c.id);
        if (!p || !canOrder(p)) return { lines, error: `Le pack « ${b.title} » n'est pas disponible pour le moment.` };
        comps.push({ p, qty: c.qty * it.qty });
      }
      if (!comps.length) return { lines, error: `Le pack « ${b.title} » est vide.` };
      for (const c of comps) need.set(c.p.id, (need.get(c.p.id) ?? 0) + c.qty);
      lines.push({ id: it.id, kind: "pack", title: `Pack ${b.title}`, category: "Pack", unitPrice: b.price, qty: it.qty, lineTotal: b.price * it.qty, components: comps });
      continue;
    }
    const p = byId.get(it.id);
    if (!p) return { lines, error: `Produit inconnu : ${it.id}` };
    if (!canOrder(p)) return { lines, error: `« ${p.title} » n'est pas disponible à la commande pour le moment. Retirez-le du panier ou demandez un devis.` };
    need.set(p.id, (need.get(p.id) ?? 0) + it.qty);
    lines.push({ id: p.id, kind: "product", title: p.title, category: p.category, unitPrice: p.price, qty: it.qty, lineTotal: p.price * it.qty, components: [{ p, qty: it.qty }] });
  }
  for (const [id, q] of need) {
    const p = byId.get(id)!;
    if (p.stockQty != null && p.availability === "en stock" && q > p.stockQty)
      return { lines, error: `Stock insuffisant pour « ${p.title} » (${p.stockQty} disponible${p.stockQty > 1 ? "s" : ""}).` };
  }
  return { lines };
}

export const ctxItems = (lines: PricedLine[]): CartItemCtx[] =>
  lines.flatMap((l) => l.components.map((c) => ({ id: c.p.id, cat: categoryKey(c.p), catSlug: c.p.catSlug })));

/* ------------------------------ Codes promo ------------------------------ */
export type CouponResult = { ok: true; code: string; discount: number; label: string } | { ok: false; message: string };

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

export async function evaluateCoupon(rawCode: string, subtotal: number): Promise<CouponResult> {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, message: "Code promo non valable" };
  const c = await prisma.coupon.findUnique({ where: { code } });
  if (!c || !c.active || !isLive(c) || c.value <= 0) return { ok: false, message: "Code promo non valable" };
  if (c.usageLimit != null && c.usedCount >= c.usageLimit) return { ok: false, message: "Code promo épuisé" };
  if (subtotal < c.minOrder) return { ok: false, message: `Code promo valable à partir de ${c.minOrder.toLocaleString("fr-FR")} DH d'achat` };
  const discount = Math.min(subtotal, c.kind === "percent" ? Math.round((subtotal * Math.min(c.value, 90)) / 100) : c.value);
  return { ok: true, code, discount, label: c.kind === "percent" ? `${c.value} %` : `${c.value} DH` };
}
