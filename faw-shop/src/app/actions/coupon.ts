"use server";

import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/security";
import type { AppliedCoupon } from "@/components/providers";

const result = z.union([
  z.object({ ok: z.literal(true), coupon: z.object({ code: z.string(), kind: z.enum(["percent", "fixed"]), value: z.number(), minOrder: z.number() }) }),
  z.object({ ok: z.literal(false), message: z.string() }),
]);

/** Vérifie un code promo auprès de Laravel (limité en débit pour éviter l'énumération). Le total final est recalculé à la commande. */
export async function checkCoupon(code: string, subtotal: number): Promise<{ ok: true; coupon: AppliedCoupon } | { ok: false; message: string }> {
  const ip = await clientIp();
  if (!rateLimit(`coupon:${ip}`, Number(process.env.FORM_RATE_LIMIT) > 0 ? Number(process.env.FORM_RATE_LIMIT) : 20, 10 * 60_000))
    return { ok: false, message: "Trop d'essais. Réessayez plus tard." };
  const c = String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
  if (!c) return { ok: false, message: "Code promo non valable" };
  try {
    const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
    const r = await fetch(`${origin}/api/shop/coupons/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code: c, subtotal: Math.max(0, Math.min(100_000_000, Math.trunc(Number(subtotal) || 0))) }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (r.status === 429) return { ok: false, message: "Trop d'essais. Réessayez plus tard." };
    const v = result.safeParse(await r.json().catch(() => null));
    return v.success ? v.data : { ok: false, message: "Code promo non valable" };
  } catch {
    return { ok: false, message: "Service momentanément indisponible. Merci de réessayer." };
  }
}
