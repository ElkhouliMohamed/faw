"use server";

import { z } from "zod";
import { previewCart, type CartPreview } from "@/lib/commerce";
import { clientIp, rateLimit } from "@/lib/security";

const input = z.object({
  items: z.array(z.object({ id: z.string().min(1).max(90), qty: z.number().int().min(1).max(999) })).min(1).max(20),
  deliveryMode: z.string().max(60).regex(/^[a-z0-9-]*$/).optional(),
  pickup: z.boolean().optional(),
  coupon: z.string().max(40).nullable().optional(),
});

/**
 * Récapitulatif du panier calculé par Laravel (prix, promotions, frais de livraison, code promo, TVA, modes de paiement).
 * Server Action (POST, contrôle d'origine Next). Limité par IP : le panier le rappelle à chaque modification.
 */
export async function getCartPreview(raw: unknown): Promise<CartPreview | null> {
  const ip = await clientIp();
  if (!rateLimit(`cart-preview:${ip}`, 180, 60_000)) return null;
  const v = input.safeParse(raw);
  if (!v.success) return null;
  const coupon = v.data.coupon ? v.data.coupon.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40) : null;
  return previewCart({ ...v.data, coupon });
}
