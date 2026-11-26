"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { spamCheck } from "@/lib/security";
export type QuoteFormState =
  | { ok: false; message?: string; errors?: Record<string, string>; refused?: false }
  | { ok: false; refused: true; message: string; wa: string }
  | null;
export async function createQuote(_prev: QuoteFormState, fd: FormData): Promise<QuoteFormState> {
  const spam = await spamCheck(fd, "quote");
  if (!spam.ok) return { ok: false, message: spam.message };
  let items: unknown;
  try { items = JSON.parse(String(fd.get("items") || "[]")); }
  catch { return { ok: false, message: "Panier invalide." }; }
  const kit = String(fd.get("kitLeaf") || "").replace(",", ".");
  const phone = String(fd.get("phone") || "").replace(/[\s.()\-]/g, "");
  let attribution: Record<string, unknown> = {};
  try { attribution = JSON.parse(String(fd.get("attribution") || "{}")); } catch {}
  const payload = { attribution,
    name: fd.get("name"), clientType: fd.get("clientType") || "particulier", company: fd.get("company"),
    ice: fd.get("ice") || null, email: fd.get("email") || null,
    phone: /^[5-7]\d{8}$/.test(phone) ? `0${phone}` : phone,
    city: fd.get("city"), pickup: fd.get("pickup") === "1", items,
    note: fd.get("note") || "", custom: fd.get("custom") === "1", kitLeaf: kit ? Number(kit) : null,
  };
  let token: string;
  try {
    const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
    const response = await fetch(`${origin}/api/quotes`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15000) });
    if (!response.ok) {
      const error = z.object({ message: z.string().optional(), errors: z.record(z.string(), z.array(z.string())).optional() }).safeParse(await response.json());
      return { ok: false, message: error.success ? error.data.message || "Vérifiez les champs." : "Demande non enregistrée.", errors: error.success ? Object.fromEntries(Object.entries(error.data.errors || {}).map(([k, v]) => [k, v[0]])) : {} };
    }
    token = z.object({ token: z.string().regex(/^[\w-]{32}$/) }).parse(await response.json()).token;
  } catch { return { ok: false, message: "Service momentanément indisponible. Merci de réessayer." }; }
  redirect(`/devis/confirmation/${token}`);
}
