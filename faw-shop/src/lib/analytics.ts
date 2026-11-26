import "server-only";
import { prisma } from "./db";
import { EVENT_TYPES } from "./events";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" });
export const RANGES = [7, 30, 90] as const;
export const FUNNEL_LABEL: Record<(typeof EVENT_TYPES)[number], string> = {
  view: "Visites",
  product_view: "Fiches produit vues",
  add_to_cart: "Ajouts au panier",
  checkout: "Passage à la commande",
  quote_request: "Demandes de devis",
  order: "Demandes envoyées",
};

export async function analytics(days: number) {
  const since = new Date(Date.now() - days * 86_400_000);
  const [orders, items, events, quotes] = await Promise.all([
    prisma.order.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, total: true, city: true, status: true, utmSource: true, gclid: true, fbclid: true } }),
    prisma.orderItem.findMany({ where: { order: { createdAt: { gte: since } } }, select: { productId: true, title: true, quantity: true, lineTotal: true } }),
    prisma.event.findMany({ where: { at: { gte: since } }, select: { at: true, type: true, sid: true, source: true } }),
    prisma.quote.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, totalTtc: true } }),
  ]);
  // Jours (heure de Casablanca)
  const dayKeys: string[] = [];
  for (let i = days - 1; i >= 0; i--) dayKeys.push(dayFmt.format(new Date(Date.now() - i * 86_400_000)));
  const byDay = new Map(dayKeys.map((d) => [d, { day: d, orders: 0, value: 0, quotes: 0, visits: new Set<string>() }]));
  for (const o of orders) {
    const d = byDay.get(dayFmt.format(o.createdAt));
    if (d) { d.orders++; d.value += o.total; }
  }
  for (const q of quotes) {
    const d = byDay.get(dayFmt.format(q.createdAt));
    if (d) d.quotes++;
  }
  for (const e of events) if (e.type === "view") byDay.get(dayFmt.format(e.at))?.visits.add(e.sid ?? `anon-${e.at.getTime()}`);
  const daily = [...byDay.values()].map((d) => ({ day: d.day, orders: d.orders, value: d.value, quotes: d.quotes, visits: d.visits.size }));

  const prod = new Map<string, { id: string; title: string; qty: number; value: number; lines: number }>();
  for (const it of items) {
    const p = prod.get(it.productId) ?? { id: it.productId, title: it.title, qty: 0, value: 0, lines: 0 };
    p.qty += it.quantity; p.value += it.lineTotal; p.lines++;
    prod.set(it.productId, p);
  }
  const products = [...prod.values()].sort((a, b) => b.value - a.value).slice(0, 15);

  const city = new Map<string, { city: string; orders: number; value: number; won: number }>();
  for (const o of orders) {
    const k = (o.city || "—").trim();
    const c = city.get(k.toLowerCase()) ?? { city: k, orders: 0, value: 0, won: 0 };
    c.orders++; c.value += o.total; if (o.status === "gagné") c.won += o.total;
    city.set(k.toLowerCase(), c);
  }
  const cities = [...city.values()].sort((a, b) => b.orders - a.orders).slice(0, 15);

  // Entonnoir : sessions distinctes ayant atteint chaque étape.
  const sess = (type: string, src?: string) => new Set(events.filter((e) => e.type === type && (src === undefined || (e.source ?? "direct") === src)).map((e) => e.sid ?? `anon-${e.at.getTime()}`)).size;
  const funnel = EVENT_TYPES.map((t) => ({ type: t, label: FUNNEL_LABEL[t], sessions: sess(t) }));
  const sources = [...new Set(events.map((e) => e.source ?? "direct"))]
    .map((s) => ({ source: s, steps: EVENT_TYPES.map((t) => sess(t, s)) }))
    .sort((a, b) => b.steps[0] - a.steps[0])
    .slice(0, 12);
  const totals = { orders: orders.length, value: orders.reduce((a, o) => a + o.total, 0), won: orders.filter((o) => o.status === "gagné").reduce((a, o) => a + o.total, 0), quotes: quotes.length, visits: funnel[0].sessions };
  return { days, daily, products, cities, funnel, sources, totals, eventCount: events.length };
}
