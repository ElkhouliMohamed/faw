"use server";

import { clientIp, rateLimit } from "@/lib/security";
import { evaluateCoupon, normalizeCode } from "@/lib/pricing";
import { prisma } from "@/lib/db";
import type { AppliedCoupon } from "@/components/providers";

/** Vérifie un code promo (limité en débit pour éviter l'énumération). */
export async function checkCoupon(code: string, subtotal: number): Promise<{ ok: true; coupon: AppliedCoupon } | { ok: false; message: string }> {
  const ip = await clientIp();
  if (!rateLimit(`coupon:${ip}`, Number(process.env.FORM_RATE_LIMIT) > 0 ? Number(process.env.FORM_RATE_LIMIT) : 20, 10 * 60_000))
    return { ok: false, message: "Trop d'essais. Réessayez plus tard." };
  const c = normalizeCode(String(code ?? ""));
  const r = await evaluateCoupon(c, Math.max(0, Math.trunc(Number(subtotal) || 0)));
  if (!r.ok) return r;
  const row = await prisma.coupon.findUnique({ where: { code: r.code } });
  if (!row) return { ok: false, message: "Code promo non valable" };
  return { ok: true, coupon: { code: row.code, kind: row.kind === "percent" ? "percent" : "fixed", value: row.value, minOrder: row.minOrder } };
}
