import "server-only";
// Lecture + validation générique d'un formulaire CRUD à partir de la description des champs.
import { z } from "zod";
import { blocksSchema } from "./blocks";
import type { FieldSpec } from "./crud-types";

export type Parsed = { ok: true; data: Record<string, unknown> } | { ok: false; errors: Record<string, string> };

const DEFAULT_MAX: Partial<Record<FieldSpec["type"], number>> = { text: 200, textarea: 5000, markdown: 60000, lines: 5000, url: 500, email: 160, slug: 80, password: 200, image: 500 };

export function parseFields(fields: FieldSpec[], fd: FormData, isCreate: boolean): Parsed {
  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};
  for (const f of fields) {
    if (f.createOnly && !isCreate) continue;
    const raw = fd.get(f.name);
    const str = typeof raw === "string" ? raw : "";
    const v = f.type === "textarea" || f.type === "markdown" || f.type === "lines" ? str.replace(/\r\n/g, "\n").trim() : str.trim();
    const max = f.max ?? DEFAULT_MAX[f.type] ?? 200;
    const fail = (m: string) => (errors[f.name] = m);
    switch (f.type) {
      case "bool":
        data[f.name] = raw === "1" || raw === "on";
        break;
      case "multi": {
        const vals = fd.getAll(f.name).map(String).filter(Boolean);
        if (f.options && vals.some((x) => !f.options!.some((o) => o.value === x))) fail("Valeur inconnue");
        else data[f.name] = vals.slice(0, 500);
        break;
      }
      case "int":
      case "money": {
        const n = v.replace(/[\s\u202f]/g, "");
        if (n === "") {
          if (f.required) fail("Requis");
          else data[f.name] = f.nullable ? null : 0;
          break;
        }
        const r = z.coerce.number().int("Nombre entier attendu").safeParse(n);
        if (!r.success || !/^-?\d+$/.test(n)) fail("Nombre entier attendu");
        else if (f.min != null && r.data < f.min) fail(`Minimum ${f.min}`);
        else if (f.max != null && r.data > f.max) fail(`Maximum ${f.max}`);
        else data[f.name] = r.data;
        break;
      }
      case "datetime": {
        if (!v) {
          if (f.required) fail("Requis");
          else data[f.name] = null;
          break;
        }
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) fail("Date invalide");
        else data[f.name] = d;
        break;
      }
      case "blocks": {
        try {
          const r = blocksSchema.safeParse(JSON.parse(v || "[]"));
          if (!r.success) fail(r.error.issues[0]?.message ?? "Blocs invalides");
          else data[f.name] = JSON.stringify(r.data);
        } catch {
          fail("Blocs invalides");
        }
        break;
      }
      default: {
        if (!v) {
          if (f.required && !(f.type === "password")) fail("Requis");
          else data[f.name] = f.type === "image" ? null : "";
          break;
        }
        if (v.length > max) {
          fail(`${max} caractères maximum`);
          break;
        }
        if (f.type === "slug" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) fail("Minuscules, chiffres et tirets uniquement");
        else if (f.type === "email" && !z.email().safeParse(v).success) fail("E-mail invalide");
        else if (f.type === "url" && !(/^\/(?!\/)/.test(v) || /^https:\/\/[^\s]+$/.test(v))) fail("Lien interne (/…) ou https://");
        else if (f.type === "image" && !/^\/(?!\/)[\w\-./]+$/.test(v)) fail("Image de la médiathèque uniquement");
        else if (f.type === "color" && !/^#[0-9a-fA-F]{6}$/.test(v)) fail("Couleur #RRGGBB");
        else if (f.type === "select" && f.options && !f.options.some((o) => o.value === v)) fail("Valeur inconnue");
        else data[f.name] = v;
      }
    }
    if (f.type === "select" && !v && !errors[f.name]) {
      if (f.required) errors[f.name] = "Requis";
      else data[f.name] = "";
    }
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, data };
}
