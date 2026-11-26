"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, PermissionError, requireWrite } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { CART_STATUSES } from "@/lib/carts";

const schema = z.object({ id: z.string().regex(/^[a-z0-9]{16,40}$/), status: z.enum(CART_STATUSES) });

export async function setCartStatus(id: string, status: string): Promise<{ ok: boolean; message: string }> {
  let admin;
  try {
    admin = await requireWrite("carts");
  } catch (x) {
    return { ok: false, message: x instanceof PermissionError ? x.message : "Non autorisé" };
  }
  const v = schema.safeParse({ id, status });
  if (!v.success) return { ok: false, message: "Valeur invalide" };
  const c = await prisma.cart.findUnique({ where: { id: v.data.id }, select: { id: true } });
  if (!c) return { ok: false, message: "Introuvable" };
  await prisma.cart.update({ where: { id: c.id }, data: { status: v.data.status, ...(v.data.status === "relancé" ? { remindedAt: new Date() } : {}) } });
  await audit(admin, "status", "carts", c.id.slice(0, 8), v.data.status);
  revalidatePath("/admin/paniers");
  return { ok: true, message: "Enregistré" };
}
