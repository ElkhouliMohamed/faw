import { prisma } from "@/lib/db";
import { normalizePhone } from "@/lib/crm";
import { priceItems } from "@/lib/pricing";
import { readJson, sameOrigin } from "@/lib/same-origin";
import { clientIp, rateLimit } from "@/lib/security";

// Synchronisation anonyme du panier (paniers abandonnés). Coordonnées seulement si envoyées depuis le
// formulaire de commande avec consentement. Jamais d'IP stockée.
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, max) || null : null);

export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!rateLimit(`cart:${await clientIp()}`, 120, 10 * 60_000)) return new Response(null, { status: 429 });
  const b = await readJson(req, 6_000);
  const id = typeof b?.id === "string" && /^[a-z0-9]{16,40}$/.test(b.id) ? b.id : null;
  if (!b || !id) return new Response(null, { status: 400 });
  const raw = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
  const items = raw
    .map((x) => ({ id: String((x as { id?: unknown }).id ?? "").slice(0, 90), qty: Math.max(1, Math.min(99, Math.trunc(Number((x as { qty?: unknown }).qty) || 1))) }))
    .filter((x) => /^[A-Za-z0-9:_-]+$/.test(x.id));
  const priced = await priceItems(items).catch(() => ({ lines: [] as { lineTotal: number; qty: number }[] }));
  const subtotal = priced.lines.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = items.reduce((s, l) => s + l.qty, 0);
  const phoneRaw = str(b.phone, 30);
  const phone = phoneRaw && /^[+\d\s().-]{8,30}$/.test(phoneRaw) ? normalizePhone(phoneRaw) : null;
  const email = str(b.email, 160);
  const contact = {
    ...(str(b.name, 120) ? { name: str(b.name, 120) } : {}),
    ...(phone ? { phone } : {}),
    ...(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}),
  };
  const existing = await prisma.cart.findUnique({ where: { id }, select: { status: true } });
  if (existing?.status === "récupéré") return new Response(null, { status: 204 });
  await prisma.cart.upsert({
    where: { id },
    create: { id, items: JSON.stringify(items), itemCount, subtotal, utmSource: str(b.utmSource, 60), utmCampaign: str(b.utmCampaign, 100), ...contact },
    update: { items: JSON.stringify(items), itemCount, subtotal, ...contact },
  });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
