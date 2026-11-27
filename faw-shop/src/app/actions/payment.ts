"use server";

import { revalidatePath } from "next/cache";
import { ORDER_NUMBER_RE, sendOrderProof } from "@/lib/commerce";
import { clientIp, rateLimit } from "@/lib/security";

const PROOF_MAX = 5 * 1024 * 1024;
const PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** Justificatif de virement d'une commande site (numéro privé). Laravel vérifie le vrai type MIME, la taille et l'état du paiement. */
export async function uploadOrderProof(number: string, form: FormData): Promise<{ ok: boolean; code: string }> {
  if (!ORDER_NUMBER_RE.test(String(number))) return { ok: false, code: "proof_not_allowed" };
  if (!rateLimit(`order-proof:${await clientIp()}`, 10, 10 * 60_000)) return { ok: false, code: "error" };
  const file = form.get("proof");
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: "proof_missing" };
  if (file.size > PROOF_MAX) return { ok: false, code: "proof_too_large" };
  if (file.type && !PROOF_TYPES.includes(file.type)) return { ok: false, code: "proof_bad_type" };
  const r = await sendOrderProof(number, file);
  if (r.ok) revalidatePath(`/commande/confirmation/${number}`);
  return r;
}
