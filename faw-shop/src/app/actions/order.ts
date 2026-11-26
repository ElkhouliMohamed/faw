"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { spamCheck } from "@/lib/security";
export type OrderFormState = { ok: false; message?: string; errors?: Record<string, string> } | null;
export async function createOrder(_prev: OrderFormState, fd: FormData): Promise<OrderFormState> {
  const spam = await spamCheck(fd, "order");
  if (!spam.ok) return { ok: false, message: spam.message };
  let items: unknown;
  try { items = JSON.parse(String(fd.get("items") || "[]")); } catch { return { ok: false, message: "Panier invalide." }; }
  let attribution: Record<string, unknown> = {};
  try { attribution = JSON.parse(String(fd.get("attribution") || "{}")); } catch {}
  const payload = { attribution, coupon: fd.get("coupon") || null, cartId: fd.get("cartId") || null, name: fd.get("customerName"), phone: fd.get("phone"), email: fd.get("email") || null, city: fd.get("city"),
    address: fd.get("address") || "", company: fd.get("company"), ice: fd.get("ice") || null, paymentMethod: fd.get("paymentMethod"),
    deliveryMode: fd.get("deliveryMode"), pickup: fd.get("deliveryMode") === "retrait", note: fd.get("notes"), items };
  let number: string;
  try {
    const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
    const response = await fetch(`${origin}/api/orders`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { ok: false, message: "Demande non enregistrée. Vérifiez les coordonnées et le panier, puis réessayez." };
    number = z.object({ number: z.string() }).parse(await response.json()).number;
  } catch { return { ok: false, message: "Service momentanément indisponible. Merci de réessayer." }; }
  redirect(`/commande/confirmation/${number}?nouveau=1`);
}
