import "server-only";
import { z } from "zod";
import { clientIp } from "./security";

// Tunnel d'achat : appels à l'API Laravel (récapitulatif serveur, commande, paiement). Jamais de cache : données privées
// ou dépendantes du panier. Laravel recalcule toujours prix, frais, code promo et modes de paiement.

const origin = () => process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";

export const ORDER_NUMBER_RE = /^FAW-\d{6}-[0-9A-F]{32}$/;

export type CartItemInput = { id: string; qty: number };
export type PaymentKey = "virement" | "reception" | "carte";

const paymentOption = z.object({ key: z.enum(["virement", "reception", "carte"]), available: z.boolean(), reason: z.string().nullable() });
export type PaymentOption = z.infer<typeof paymentOption>;

const blocker = z.object({ id: z.string(), reason: z.enum(["quote_only", "over_max", "unavailable"]), max: z.number().optional() });
export type CartBlocker = z.infer<typeof blocker>;

const previewSchema = z.union([
  z.object({
    pricesHidden: z.literal(true),
    quoteRequired: z.literal(true),
    blockers: z.array(blocker),
    items: z.array(z.object({ id: z.string(), title: z.string(), qty: z.number() })),
  }),
  z.object({
    pricesHidden: z.literal(false),
    currency: z.string(),
    taxRate: z.number(),
    items: z.array(
      z.object({
        id: z.string(), title: z.string(), qty: z.number(),
        unitTtc: z.number().nullable(), unitHt: z.number().nullable(), totalTtc: z.number().nullable(), totalHt: z.number().nullable(),
        blocker: z.enum(["quote_only", "over_max", "unavailable"]).nullable(), maxOnlineQty: z.number().nullable(),
      }),
    ),
    blockers: z.array(blocker),
    quoteRequired: z.boolean(),
    subtotalTtc: z.number().nullable(), subtotalHt: z.number().nullable(), discount: z.number().nullable(),
    coupon: z.string().nullable(), couponError: z.string().nullable().optional(),
    deliveryMode: z.string(), deliveryModes: z.array(z.string()),
    shipping: z.object({ fee: z.number().nullable(), label: z.string(), toConfirm: z.boolean() }),
    totalTtc: z.number().nullable(), totalHt: z.number().nullable(), tva: z.number().nullable(),
    payments: z.array(paymentOption),
  }),
]);
export type CartPreview = z.infer<typeof previewSchema>;

/** Récapitulatif calculé par Laravel (aucun effet : le code promo est vérifié, pas consommé). null si indisponible. */
export async function previewCart(input: { items: CartItemInput[]; deliveryMode?: string; pickup?: boolean; coupon?: string | null }): Promise<CartPreview | null> {
  if (!input.items.length) return null;
  try {
    const r = await fetch(`${origin()}/api/shop/checkout/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const v = previewSchema.safeParse(await r.json());
    return v.success ? v.data : null;
  } catch {
    return null;
  }
}

export type PlaceOrderResult = { ok: true; number: string; paymentMethod: PaymentKey } | { ok: false; message?: string; errors: Record<string, string> };

/** Envoie la commande ; Laravel valide, recalcule et crée la commande (historique, audit, e-mails). */
export async function placeOrder(payload: Record<string, unknown>): Promise<PlaceOrderResult> {
  try {
    const r = await fetch(`${origin()}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    const body = await r.json().catch(() => null);
    if (r.ok) {
      const v = z.object({ number: z.string().regex(ORDER_NUMBER_RE), paymentMethod: z.enum(["virement", "reception", "carte"]) }).safeParse(body);
      return v.success ? { ok: true, ...v.data } : { ok: false, errors: {} };
    }
    const err = z.object({ message: z.string().optional(), errors: z.record(z.string(), z.array(z.string())).optional() }).safeParse(body);
    if (r.status === 429) return { ok: false, message: "rate", errors: {} };
    return { ok: false, message: err.success ? err.data.message : undefined, errors: err.success ? Object.fromEntries(Object.entries(err.data.errors ?? {}).map(([k, v]) => [k, v[0] ?? ""])) : {} };
  } catch {
    return { ok: false, errors: {} };
  }
}

const bankSchema = z.object({ rib: z.string().nullable(), iban: z.string().nullable(), holder: z.string().nullable(), bankName: z.string().nullable(), branch: z.string().nullable(), swift: z.string().nullable() });
const orderSchema = z.object({
  number: z.string(),
  customerName: z.string(),
  city: z.string(),
  deliveryMode: z.string(),
  deliveryFee: z.number(),
  deliveryNote: z.string().nullable(),
  paymentMethod: z.string(),
  total: z.number(),
  items: z.array(z.object({ id: z.number(), productId: z.string(), title: z.string(), quantity: z.number(), unitPrice: z.number().optional(), lineTotal: z.number() })),
  status: z.string().optional(),
  paymentStatus: z.string().nullable().optional(),
  subtotal: z.number().optional(),
  couponCode: z.string().nullable().optional(),
  couponDiscount: z.number().optional(),
  company: z.string().nullable().optional(),
  taxRate: z.number().optional(),
  totalHt: z.number().optional(),
  tva: z.number().optional(),
  pickupAddress: z.string().nullable().optional(),
  payment: z
    .object({
      reference: z.string(), amount: z.number(), currency: z.string(), status: z.string(), method: z.string(),
      proofUploaded: z.boolean(), canUploadProof: z.boolean(), canPayByCard: z.boolean(), bank: bankSchema.nullable(),
      proofRules: z.object({ types: z.array(z.string()), maxBytes: z.number() }),
    })
    .nullable()
    .optional(),
});
export type OrderDetails = z.infer<typeof orderSchema>;

/** Commande récente sur son numéro privé (128 bits aléatoires), sinon null. */
export async function orderDetails(number: string): Promise<OrderDetails | null> {
  if (!ORDER_NUMBER_RE.test(number)) return null;
  try {
    const r = await fetch(`${origin()}/api/shop/orders/${number}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const v = orderSchema.safeParse(await r.json());
    return v.success ? v.data : null;
  } catch {
    return null;
  }
}

export type CmiForm = { action: string; fields: Record<string, string> };

/** Formulaire CMI signé par Laravel (uniquement si le paiement carte est activé et la commande encore à payer). */
export async function cmiForm(number: string): Promise<CmiForm | null> {
  if (!ORDER_NUMBER_RE.test(number)) return null;
  try {
    const r = await fetch(`${origin()}/api/shop/orders/${number}/cmi`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const v = z.object({ ok: z.literal(true), action: z.string().url().startsWith("https://"), fields: z.record(z.string(), z.string()) }).safeParse(await r.json());
    return v.success ? { action: v.data.action, fields: v.data.fields } : null;
  } catch {
    return null;
  }
}

/** Relais du justificatif de virement vers Laravel (qui vérifie le vrai type, la taille et stocke en privé). */
export async function sendOrderProof(number: string, file: File): Promise<{ ok: boolean; code: string }> {
  if (!ORDER_NUMBER_RE.test(number)) return { ok: false, code: "proof_not_allowed" };
  const ip = await clientIp();
  const body = new FormData();
  body.append("proof", file, file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "justificatif");
  try {
    const r = await fetch(`${origin()}/api/shop/orders/${number}/proof`, {
      method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(30000),
      headers: { Accept: "application/json", "X-Faw-Client-Ip": ip },
    });
    const v = z.object({ ok: z.boolean().optional(), code: z.string().optional() }).safeParse(await r.json().catch(() => ({})));
    const d = v.success ? v.data : {};
    return { ok: !!d.ok, code: d.code || (r.status === 413 ? "proof_too_large" : r.status === 404 ? "proof_not_allowed" : "error") };
  } catch {
    return { ok: false, code: "error" };
  }
}
