import "server-only";
import type { Column, EntityDef, Row } from "./entities";
import type { FieldSpec } from "./crud-types";

const pad = (n: number) => String(n).padStart(2, "0");
/** Date → valeur d'un input datetime-local (heure locale du serveur). */
export const toLocalInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const SECRET = /hash|secret|password|token/i;

/** Valeurs envoyées au formulaire client : uniquement les champs déclarés, jamais de secret. */
export function formValues(fields: FieldSpec[], src: Record<string, unknown>) {
  const out: Record<string, string | string[] | boolean> = {};
  for (const f of fields) {
    if (f.type === "password" || SECRET.test(f.name) && f.type !== "bool") {
      out[f.name] = "";
      continue;
    }
    const v = src[f.name];
    if (f.type === "bool") out[f.name] = Boolean(v);
    else if (f.type === "multi") out[f.name] = Array.isArray(v) ? v.map(String) : String(v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    else if (f.type === "datetime") out[f.name] = v instanceof Date ? toLocalInput(v) : v ? String(v) : "";
    else out[f.name] = v == null ? "" : String(v);
  }
  return out;
}

const fmtDate = (d: Date) => d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });
export function cellValue(c: Column, r: Row): { text: string; kind: Column["kind"] } {
  const raw = c.get ? c.get(r) : r[c.name];
  if (c.kind === "bool") return { text: raw ? "Oui" : "Non", kind: "bool" };
  if (c.kind === "date") return { text: raw instanceof Date ? fmtDate(raw) : raw ? fmtDate(new Date(String(raw))) : "—", kind: "date" };
  if (c.kind === "money") return { text: raw == null || raw === "" ? "—" : `${Number(raw).toLocaleString("fr-FR")} DH`, kind: "money" };
  const s = raw == null || raw === "" ? "—" : String(raw);
  return { text: s.length > 120 ? `${s.slice(0, 117)}…` : s, kind: c.kind };
}

/** Clause de recherche Prisma (OR sur les colonnes texte déclarées). */
export function searchWhere(e: EntityDef, q: string) {
  const t = q.trim().slice(0, 80);
  if (!t) return {};
  return { OR: e.search.map((k) => ({ [k]: { contains: t } })) };
}
