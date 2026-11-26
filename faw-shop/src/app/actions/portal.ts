"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { QUOTE_TOKEN_RE } from "@/lib/devis";
import { laravelOrigin } from "@/lib/portal";

/**
 * Actions du portail client. Server Actions = POST uniquement, contrôle d'origine Next (protection CSRF).
 * L'adresse IP et le navigateur du client sont transmis à Laravel pour la piste d'audit.
 */
export type PortalResult = { ok: boolean; code: string; emailMasked?: string; remaining?: number };

async function call(token: string, path: string, body: Record<string, unknown>): Promise<PortalResult> {
  if (!QUOTE_TOKEN_RE.test(token)) return { ok: false, code: "not_ready" };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
  try {
    const r = await fetch(`${laravelOrigin()}/api/portal/${token}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Faw-Client-Ip": ip, "X-Faw-Client-Ua": (h.get("user-agent") || "").slice(0, 500) },
      body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20000),
    });
    const parsed = z.object({ ok: z.boolean().optional(), code: z.string().optional(), emailMasked: z.string().nullable().optional(), remaining: z.number().optional() }).safeParse(await r.json().catch(() => ({})));
    const d = parsed.success ? parsed.data : {};
    if (d.ok) revalidatePath(`/devis/suivi/${token}`);
    return { ok: !!d.ok, code: d.code || (r.status === 404 ? "not_ready" : "error"), emailMasked: d.emailMasked ?? undefined, remaining: d.remaining };
  } catch {
    return { ok: false, code: "error" };
  }
}

const id = z.coerce.number().int().positive();

export async function requestOtp(token: string, versionId: number) {
  return call(token, "otp", { versionId: id.parse(versionId) });
}
export async function acceptQuote(token: string, versionId: number, code: string, confirm: boolean) {
  return call(token, "accept", { versionId: id.parse(versionId), code: String(code).replace(/\D/g, "").slice(0, 6), confirm: confirm === true });
}
export async function refuseQuote(token: string, versionId: number, reason: string) {
  return call(token, "refuse", { versionId: id.parse(versionId), reason: String(reason || "").slice(0, 1000) || null });
}
export async function requestChange(token: string, message: string) {
  return call(token, "modification", { message: String(message || "").slice(0, 2000) });
}

const PROOF_MAX = 5 * 1024 * 1024;
const PROOF_TYPES = ["application/pdf", "image/jpeg", "image/png"];

/** Justificatif de virement : relayé tel quel à Laravel, qui vérifie le vrai type MIME, la taille et stocke en privé. */
export async function uploadProof(token: string, paymentId: number, form: FormData): Promise<PortalResult> {
  if (!QUOTE_TOKEN_RE.test(token)) return { ok: false, code: "not_ready" };
  const file = form.get("proof");
  if (!(file instanceof File) || file.size === 0) return { ok: false, code: "proof_missing" };
  if (file.size > PROOF_MAX) return { ok: false, code: "proof_too_large" };
  if (file.type && !PROOF_TYPES.includes(file.type)) return { ok: false, code: "proof_bad_type" };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "";
  const body = new FormData();
  body.append("proof", file, file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "justificatif");
  try {
    const r = await fetch(`${laravelOrigin()}/api/portal/${token}/payments/${id.parse(paymentId)}/proof`, {
      method: "POST", body, cache: "no-store", signal: AbortSignal.timeout(30000),
      headers: { Accept: "application/json", "X-Faw-Client-Ip": ip, "X-Faw-Client-Ua": (h.get("user-agent") || "").slice(0, 500) },
    });
    const parsed = z.object({ ok: z.boolean().optional(), code: z.string().optional() }).safeParse(await r.json().catch(() => ({})));
    const d = parsed.success ? parsed.data : {};
    if (d.ok) revalidatePath(`/devis/suivi/${token}`);
    return { ok: !!d.ok, code: d.code || (r.status === 413 ? "proof_too_large" : r.status === 404 ? "not_ready" : "error") };
  } catch {
    return { ok: false, code: "error" };
  }
}
