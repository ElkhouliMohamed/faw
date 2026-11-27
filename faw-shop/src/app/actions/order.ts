"use server";

import { redirect } from "next/navigation";
import { placeOrder } from "@/lib/commerce";
import { commerceDict } from "@/lib/commerce-dict";
import { spamCheck } from "@/lib/security";

export type OrderFormState = { ok: false; message?: string; errors?: Record<string, string> } | null;

const str = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);

/**
 * Commande en ligne. Anti-spam (jeton signé, champ piège, limite par IP) puis envoi à Laravel, qui revalide tout et
 * recalcule les montants : aucun total du navigateur n'est transmis.
 */
export async function createOrder(_prev: OrderFormState, fd: FormData): Promise<OrderFormState> {
  const c = commerceDict("fr");
  const spam = await spamCheck(fd, "order");
  if (!spam.ok) return { ok: false, message: spam.message };
  let items: unknown;
  try {
    items = JSON.parse(String(fd.get("items") || "[]"));
  } catch {
    return { ok: false, message: c.checkout.errors, errors: { items: "Panier invalide." } };
  }
  let attribution: Record<string, unknown> = {};
  try {
    attribution = JSON.parse(String(fd.get("attribution") || "{}"));
  } catch {}
  const phone = str(fd, "phone", 30).replace(/[\s.()-]/g, "");
  const clientType = fd.get("clientType") === "entreprise" ? "entreprise" : "particulier";
  const deliveryMode = str(fd, "deliveryMode", 60);
  const pickup = deliveryMode === "retrait";
  const payload = {
    items,
    attribution,
    name: str(fd, "name", 80),
    phone: /^[5-7]\d{8}$/.test(phone) ? `0${phone}` : phone,
    email: str(fd, "email", 120),
    clientType,
    company: clientType === "entreprise" ? str(fd, "company", 120) || null : null,
    ice: clientType === "entreprise" ? str(fd, "ice", 30).replace(/\s/g, "") || null : null,
    city: str(fd, "city", 60),
    address: pickup ? "" : str(fd, "address", 300),
    pickup,
    deliveryMode: pickup ? "retrait" : deliveryMode || null,
    paymentMethod: str(fd, "paymentMethod", 20),
    coupon: str(fd, "coupon", 40) || null,
    cartId: /^[a-z0-9]{16,40}$/.test(str(fd, "cartId", 40)) ? str(fd, "cartId", 40) : null,
    note: str(fd, "note", 600) || null,
    cgv: fd.get("cgv") === "1",
  };
  const r = await placeOrder(payload);
  if (!r.ok) {
    if (r.message === "rate") return { ok: false, message: "Trop de demandes depuis votre connexion. Réessayez dans quelques minutes." };
    const errors = r.errors;
    if (!Object.keys(errors).length) return { ok: false, message: c.checkout.unavailable };
    return { ok: false, message: errors.items || errors.paymentMethod || c.checkout.errors, errors };
  }
  redirect(r.paymentMethod === "carte" ? `/commande/paiement/${r.number}` : `/commande/confirmation/${r.number}?nouveau=1`);
}
