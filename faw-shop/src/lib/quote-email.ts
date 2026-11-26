import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";
import { z } from "zod";
import { devisOutDir, safePdfName } from "@/lib/devis";
import { SITE } from "@/lib/site";

/*
 * Envoi du devis au client par e-mail via l'API HTTPS de Resend (fetch, sans SDK).
 * Désactivé tant que RESEND_API_KEY et QUOTE_EMAIL_FROM ne sont pas définis.
 * Appelé UNIQUEMENT depuis les actions admin (clic « Valider » ou « Renvoyer l'email »), jamais au dépôt du formulaire.
 */

const emailSchema = z.email().max(120);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type EmailConfig = { ok: true; key: string; from: string; replyTo: string; bcc: string | null; base: string } | { ok: false; reason: string };

export function emailConfig(): EmailConfig {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.QUOTE_EMAIL_FROM?.trim();
  if (!key) return { ok: false, reason: "RESEND_API_KEY absent" };
  if (!from) return { ok: false, reason: "QUOTE_EMAIL_FROM absent" };
  const replyTo = process.env.QUOTE_EMAIL_REPLY_TO?.trim() || "faw@faw.ma";
  const bccRaw = process.env.QUOTE_EMAIL_BCC?.trim() || "";
  const bcc = bccRaw && emailSchema.safeParse(bccRaw).success ? bccRaw : null;
  const base = (process.env.RESEND_API_BASE_URL?.trim() || "https://api.resend.com").replace(/\/+$/, "");
  let u: URL;
  try {
    u = new URL(base);
  } catch {
    return { ok: false, reason: "RESEND_API_BASE_URL invalide" };
  }
  // Garde-fou : en mode test, jamais d'appel vers un vrai service (seulement un faux serveur local).
  if (process.env.FAW_TEST === "1" && !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) return { ok: false, reason: "FAW_TEST=1 : API e-mail non locale refusée" };
  if (process.env.FAW_TEST !== "1" && u.protocol !== "https:") return { ok: false, reason: "RESEND_API_BASE_URL doit être en https" };
  if (!emailSchema.safeParse(replyTo).success) return { ok: false, reason: "QUOTE_EMAIL_REPLY_TO invalide" };
  return { ok: true, key, from, replyTo, bcc, base };
}

export const validClientEmail = (e: string | null | undefined): string | null => {
  const v = emailSchema.safeParse((e ?? "").trim());
  return v.success ? v.data : null;
};

/** Base publique du lien privé : QUOTE_PUBLIC_BASE_URL, sinon l'adresse utilisée par l'admin (ngrok, domaine…). */
export async function publicBaseUrl(): Promise<string> {
  const env = process.env.QUOTE_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim() || (/^(127\.|localhost)/.test(host) ? "http" : "https");
  if (!/^[\w.-]+(:\d+)?$/.test(host)) return (process.env.NEXT_PUBLIC_SITE_URL || "https://faw.ma").replace(/\/+$/, "");
  return `${proto}://${host}`;
}
export const privateLink = (base: string, token: string) => `${base}/devis/suivi/${token}`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const dh = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f|\u00a0/g, " ")} DH`;

export type QuoteMail = { to: string; clientName: string; number: string; totalTtc: number; transport: string; pdfFile: string; warranties?: { name: string; text: string }[]; salesperson?: string };

export function salespersonName(name?: string | null): string {
  const fallback = (process.env.QUOTE_SALESPERSON ?? "Walid").trim() || "Walid";
  const n = (name ?? "").trim();
  if (!n || /^faw aluminium$/i.test(n) || /^admin$/i.test(n)) return fallback;
  return n;
}

export function buildQuoteEmail(m: QuoteMail) {
  const subject = `Votre devis FAW Aluminium n° ${m.number}`;
  const phone = SITE.phone;
  const address = SITE.address;
  const commercial = salespersonName(m.salesperson);
  const reply = SITE.email;
  const text = [
    "FAW Aluminium",
    address,
    `Tél. ${phone}`,
    "",
    `Bonjour ${m.clientName},`,
    "",
    `Veuillez trouver ci-joint votre devis FAW Aluminium n° ${m.number}.`,
    `Total TTC : ${dh(m.totalTtc)} (TVA 20 % incluse), valable 14 jours.`,
    `Transport : ${m.transport}.`,
    "Remise 0 %. Transport en option hors total. Installation non incluse. Pose non comprise.",
    ...(m.warranties ?? []).map((w) => `${w.name} : ${w.text}`),
    "",
    "Pour confirmer ou poser une question, répondez à cet e-mail.",
    "",
    commercial,
    "Service commercial — FAW Aluminium",
    `Tél. ${phone}`,
    reply,
  ].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#f7f3ee;font-family:Arial,Helvetica,sans-serif;color:#432A13;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f3ee;border-collapse:collapse;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-collapse:collapse;">
<tr><td style="background:#ffffff;padding:20px 24px 16px;border-top:4px solid #F38F26;border-bottom:1px solid #eadfd3;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;"><tr>
<td valign="middle" style="width:148px;padding:0 16px 0 0;"><img src="cid:logo-faw" alt="FAW Aluminium" width="140" style="display:block;border:0;outline:none;width:140px;height:auto;max-width:140px;"></td>
<td valign="middle" style="color:#432A13;font-size:13px;line-height:1.45;"><div style="font-size:16px;font-weight:bold;color:#F38F26;letter-spacing:0.02em;">FAW Aluminium</div><div style="margin-top:6px;">${esc(address)}</div><div style="margin-top:4px;">Tél. ${esc(phone)}</div></td>
</tr></table></td></tr>
<tr><td style="padding:28px 24px 8px;color:#432A13;font-size:15px;line-height:1.55;">
<p style="margin:0 0 16px;">Bonjour ${esc(m.clientName)},</p>
<p style="margin:0 0 16px;">Veuillez trouver ci-joint votre devis FAW Aluminium n°&nbsp;<strong>${esc(m.number)}</strong>.</p>
<p style="margin:0 0 16px;">Total TTC : <strong>${esc(dh(m.totalTtc))}</strong> (TVA 20&nbsp;% incluse), valable 14 jours.<br>Transport : ${esc(m.transport)}.<br>Remise 0&nbsp;%. Transport en option hors total. Installation non incluse. Pose non comprise.</p>
${(m.warranties ?? []).map((w) => `<p style="margin:0 0 16px;"><strong>${esc(w.name)}</strong> : ${esc(w.text).replace(/\n/g, "<br>")}</p>`).join("\n")}
<p style="margin:0;">Pour confirmer ou poser une question, répondez à cet e-mail.</p>
</td></tr>
<tr><td style="padding:8px 24px 28px;color:#432A13;font-size:14px;line-height:1.5;border-top:1px solid #F38F26;">
<p style="margin:20px 0 0;font-weight:bold;color:#432A13;">${esc(commercial)}</p>
<p style="margin:4px 0 0;color:#432A13;">Service commercial — FAW Aluminium</p>
<p style="margin:4px 0 0;color:#432A13;">Tél. ${esc(phone)}</p>
<p style="margin:4px 0 0;color:#432A13;">${esc(reply)}</p>
</td></tr>
</table></td></tr></table></body></html>`;
  if (/https?:\/\/|www\.|href\s*=|mailto:|tel:|devis\/suivi|devis\/pdf/i.test(`${subject}\n${text}\n${html}`)) {
    throw new Error("Le corps de l’e-mail ne doit pas contenir de lien.");
  }
  return { subject, text, html };
}

export type SendResult = { ok: true; id: string; attached: boolean } | { ok: false; error: string };

/** Un seul destinataire : le client (plus la copie cachée interne facultative QUOTE_EMAIL_BCC). */
export async function sendQuoteEmail(m: QuoteMail, idempotencyKey: string): Promise<SendResult> {
  const cfg = emailConfig();
  if (!cfg.ok) return { ok: false, error: `Email automatique non configuré (${cfg.reason})` };
  const to = validClientEmail(m.to);
  if (!to) return { ok: false, error: "Adresse e-mail du client invalide" };
  const { subject, text, html } = buildQuoteEmail({ ...m, to });
  if (!safePdfName(m.pdfFile)) return { ok: false, error: "PDF introuvable, e-mail non envoyé." };
  let attachments: { filename: string; content: string; content_id?: string; content_type?: string }[];
  try {
    const buf = await readFile(path.join(devisOutDir(), m.pdfFile));
    if (buf.length < 1000) return { ok: false, error: "PDF introuvable, e-mail non envoyé." };
    if (buf.length > MAX_ATTACHMENT_BYTES) return { ok: false, error: "Le PDF est trop volumineux pour être envoyé par e-mail." };
    attachments = [{ filename: m.pdfFile, content: buf.toString("base64") }];
  } catch {
    return { ok: false, error: "PDF introuvable, e-mail non envoyé." };
  }
  try {
    const logo = await readFile(path.join(process.cwd(), "public/brand/logo-faw.png"));
    if (logo.length > 100 && logo.length < 500_000) {
      attachments.push({ filename: "logo-faw.png", content: logo.toString("base64"), content_id: "logo-faw", content_type: "image/png" });
    }
  } catch {}
  const body = { from: cfg.from, to: [to], reply_to: cfg.replyTo, ...(cfg.bcc ? { bcc: [cfg.bcc] } : {}), subject, text, html, attachments };
  try {
    const r = await fetch(`${cfg.base}/emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey.slice(0, 256) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    const raw = await r.text();
    let data: { id?: unknown; message?: unknown; name?: unknown } = {};
    try {
      data = JSON.parse(raw);
    } catch {}
    if (!r.ok) return { ok: false, error: `Resend ${r.status}${typeof data.message === "string" ? ` : ${data.message.slice(0, 200)}` : ""}` };
    if (typeof data.id !== "string" || !data.id) return { ok: false, error: "Réponse Resend sans identifiant" };
    return { ok: true, id: data.id.slice(0, 120), attached: !!attachments };
  } catch (e) {
    const err = e as Error;
    return { ok: false, error: err.name === "TimeoutError" ? "Délai dépassé (30 s) en contactant Resend" : `Réseau : ${err.message.slice(0, 150)}` };
  }
}
