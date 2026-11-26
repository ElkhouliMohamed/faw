"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeFrom, RESERVED_FROM } from "@/lib/admin/entities";
import { audit, PermissionError, requireWrite } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { syncRedirectSnapshot } from "@/lib/redirects";

const MAX_BYTES = 200_000;
const TO_RE = /^(\/(?!\/)[^\s]*|https:\/\/[^\s]+)$/;

export async function importRedirects(_prev: { ok: boolean; message: string } | null, fd: FormData) {
  let admin;
  try {
    admin = await requireWrite("redirects");
  } catch (x) {
    return { ok: false, message: x instanceof PermissionError ? x.message : "Non autorisé" };
  }
  let text = String(fd.get("csv") ?? "");
  const file = fd.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_BYTES) return { ok: false, message: "Fichier trop lourd (200 Ko maximum)" };
    if (!/\.(csv|txt)$/i.test(file.name)) return { ok: false, message: "Fichier .csv attendu" };
    text = await file.text();
  }
  if (text.length > MAX_BYTES) return { ok: false, message: "Contenu trop long" };
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, message: "Aucune ligne" };
  if (lines.length > 2000) return { ok: false, message: "2000 lignes maximum" };
  const errors: string[] = [];
  const valid: { from: string; to: string; code: number }[] = [];
  lines.forEach((l, i) => {
    const [a = "", b = "", c = "301"] = l.split(/[;,\t]/).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /^(source|from)$/i.test(a)) return;
    const from = normalizeFrom(a);
    const code = c === "302" ? 302 : c === "301" || c === "" ? 301 : 0;
    if (!from || from === "/" || RESERVED_FROM.test(from)) errors.push(`ligne ${i + 1} : source invalide`);
    else if (!TO_RE.test(b) || b.length > 500) errors.push(`ligne ${i + 1} : destination invalide`);
    else if (!code) errors.push(`ligne ${i + 1} : code 301 ou 302`);
    else if (from === b) errors.push(`ligne ${i + 1} : source = destination`);
    else valid.push({ from, to: b, code });
  });
  if (errors.length) return { ok: false, message: `Import annulé (rien n'a été enregistré) — ${errors.slice(0, 8).join(" ; ")}${errors.length > 8 ? "…" : ""}` };
  await prisma.$transaction(valid.map((v) => prisma.redirect.upsert({ where: { from: v.from }, create: { ...v, active: true, note: "import CSV" }, update: { to: v.to, code: v.code, active: true } })));
  await syncRedirectSnapshot();
  await audit(admin, "import", "redirects", null, `${valid.length} ligne(s)`);
  revalidatePath("/admin/m/redirects");
  redirect(`/admin/m/redirects?imported=${encodeURIComponent(`${valid.length} redirection(s) importée(s)`)}`);
}
