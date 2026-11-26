// Mini-CRM : contacts fusionnés par téléphone normalisé, pipeline des demandes (leads).
import type { Prisma, PrismaClient } from "@prisma/client";

export const LEAD_STATUSES = ["nouveau", "contacté", "devis envoyé", "gagné", "perdu"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const INTERACTION_TYPES = ["appel", "whatsapp", "visite", "devis", "note"] as const;
export const CONTACT_TYPES = ["particulier", "entreprise"] as const;
export const SUGGESTED_TAGS = ["B2B", "B2C", "revendeur", "chantier", "installateur", "promoteur", "ERP"];

/** "06 60-12 18 13" / "+212660121813" / "00212…" / "212…" -> "+212660121813". Autres pays : "+<chiffres>". */
export function normalizePhone(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  let digits = d.replace(/\+/g, "");
  if (d.startsWith("00")) digits = digits.slice(2);
  if (/^0[5-7]\d{8}$/.test(digits)) return `+212${digits.slice(1)}`;
  if (/^[5-7]\d{8}$/.test(digits)) return `+212${digits}`;
  if (/^212[5-7]\d{8}$/.test(digits)) return `+${digits}`;
  return `+${digits}`;
}

export function parseTags(s: string | null | undefined): string[] {
  return (s ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t, i, a) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);
}
export function joinTags(tags: string[]) {
  return parseTags(tags.join(",")).join(",");
}

export type Attribution = Partial<Record<"utmSource" | "utmMedium" | "utmCampaign" | "gclid" | "fbclid" | "landing" | "referrer", string>>;

export function sanitizeAttribution(input: unknown): Attribution {
  const out: Attribution = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const k of ["utmSource", "utmMedium", "utmCampaign", "gclid", "fbclid", "landing", "referrer"] as const) {
    const v = src[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 300);
  }
  return out;
}

type Db = PrismaClient | Prisma.TransactionClient;

export async function upsertContactForLead(
  db: Db,
  lead: { name: string; phone: string; email?: string | null; city?: string | null; company?: string | null; ice?: string | null; source: string; attribution?: Attribution; tags?: string[]; type?: string },
) {
  const phone = normalizePhone(lead.phone);
  const existing = await db.contact.findUnique({ where: { phone } });
  const isCompany = !!(lead.company || lead.ice) || lead.type === "entreprise";
  if (!existing) {
    return db.contact.create({
      data: {
        phone,
        name: lead.name,
        email: lead.email || null,
        city: lead.city || null,
        company: lead.company || null,
        ice: lead.ice || null,
        type: isCompany ? "entreprise" : lead.type || "particulier",
        tags: joinTags([...(lead.tags ?? []), isCompany ? "B2B" : "B2C"]),
        source: lead.source,
        ...lead.attribution,
      },
    });
  }
  const tags = parseTags(existing.tags);
  if (isCompany && !tags.includes("B2B")) tags.push("B2B");
  return db.contact.update({
    where: { id: existing.id },
    data: {
      name: existing.name || lead.name,
      email: existing.email || lead.email || null,
      city: existing.city || lead.city || null,
      company: existing.company || lead.company || null,
      ice: existing.ice || lead.ice || null,
      type: isCompany ? "entreprise" : existing.type,
      tags: joinTags([...tags, ...(lead.tags ?? [])]),
      lastActivityAt: new Date(),
    },
  });
}

export function orderNumber() {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `FAW-${ymd}-${rnd}`;
}

/** Début / fin de la journée en heure du Maroc (Africa/Casablanca). */
export function todayBoundsCasablanca(now = new Date()) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(now); // YYYY-MM-DD
  const offsetMin = (() => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Casablanca", timeZoneName: "shortOffset" }).formatToParts(now);
    const tz = p.find((x) => x.type === "timeZoneName")?.value ?? "GMT";
    const m = tz.match(/GMT([+-])(\d+)(?::(\d+))?/);
    return m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  })();
  const start = new Date(Date.parse(`${ymd}T00:00:00Z`) - offsetMin * 60_000);
  const end = new Date(start.getTime() + 86_400_000);
  return { start, end, ymd };
}

/** "2026-10-21" (date locale Maroc) -> instant UTC de minuit à Casablanca. */
export function ymdToCasablancaDate(ymd: string) {
  const { start } = todayBoundsCasablanca(new Date(`${ymd}T12:00:00Z`));
  return start;
}

export const fmtDateTime = new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });
export const fmtDate = new Intl.DateTimeFormat("fr-MA", { dateStyle: "medium", timeZone: "Africa/Casablanca" });

export function csvEscape(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // anti-injection de formules (Excel)
  return /[",\n;]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
