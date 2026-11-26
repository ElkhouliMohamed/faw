"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterChange, delegate, entityDef, fieldsOf, parseId, type EntityDef } from "@/lib/admin/entities";
import { parseFields } from "@/lib/admin/crud-parse";
import type { CrudState } from "@/lib/admin/crud-types";
import { audit, PermissionError, requireWrite } from "@/lib/admin/perm";
import { syncRedirectSnapshot } from "@/lib/redirects";

function revalidate(e: EntityDef) {
  if (e.revalidate === "layout") revalidatePath("/", "layout");
  else for (const p of e.revalidate ?? []) revalidatePath(p);
  revalidatePath(`/admin/m/${e.key}`);
}
async function post(e: EntityDef) {
  await afterChange(e);
  if (e.key === "redirects") await syncRedirectSnapshot();
  revalidate(e);
}
const SECRET = /password|hash|secret/i;
function summary(d: Record<string, unknown>) {
  return Object.keys(d)
    .filter((k) => !k.startsWith("_") && !SECRET.test(k))
    .slice(0, 12)
    .join(", ");
}

export async function saveEntity(entity: string, rawId: string, _prev: CrudState, fd: FormData): Promise<CrudState> {
  const e = entityDef(entity);
  if (!e || e.edit === false) return { ok: false, message: "Module inconnu" };
  let admin;
  try {
    admin = await requireWrite(e.perm);
  } catch (x) {
    return { ok: false, message: x instanceof PermissionError ? x.message : "Non autorisé" };
  }
  const isCreate = rawId === "nouveau";
  if (isCreate && e.create === false) return { ok: false, message: "Création impossible" };
  const id = isCreate ? null : parseId(e, rawId);
  if (!isCreate && id == null) return { ok: false, message: "Identifiant invalide" };
  const db = delegate(e);
  const prev = id == null ? null : await db.findUnique({ where: { id } });
  if (!isCreate && !prev) return { ok: false, message: "Introuvable (supprimé entre-temps ?)" };

  const fields = await fieldsOf(e);
  const parsed = parseFields(fields, fd, isCreate);
  if (!parsed.ok) return { ok: false, message: "Corrigez les champs signalés", errors: parsed.errors };
  let data = parsed.data;
  if (e.transform) {
    const t = await e.transform(data, { id, prev });
    if ("error" in t && typeof t.error === "string") return { ok: false, message: t.error, errors: t.field ? { [String(t.field)]: t.error } : undefined };
    data = t;
  }
  if (e.key === "users" && prev && admin.uid === String(id) && (data.role !== "admin" || data.active === false))
    return { ok: false, message: "Vous ne pouvez pas retirer vos propres droits d'administrateur" };
  const stored = Object.fromEntries(Object.entries(data).filter(([k]) => !k.startsWith("_")));
  let saved;
  try {
    saved = isCreate ? await db.create({ data: stored }) : await db.update({ where: { id }, data: stored });
  } catch (x) {
    const msg = String((x as Error)?.message ?? "");
    if (/Unique constraint/i.test(msg)) return { ok: false, message: "Valeur déjà utilisée (doublon)" };
    console.error("[crud]", e.key, msg.slice(0, 300));
    return { ok: false, message: "Enregistrement impossible" };
  }
  if (e.afterSave) await e.afterSave(saved, data, { id, prev });
  await audit(admin, isCreate ? "create" : "update", e.key, saved.id, summary(stored));
  await post(e);
  redirect(`/admin/m/${e.key}/${encodeURIComponent(String(saved.id))}?saved=1`);
}

export async function deleteEntity(entity: string, rawId: string): Promise<CrudState> {
  const e = entityDef(entity);
  if (!e || e.remove !== "delete") return { ok: false, message: "Suppression non disponible" };
  let admin;
  try {
    admin = await requireWrite(e.perm);
  } catch (x) {
    return { ok: false, message: x instanceof PermissionError ? x.message : "Non autorisé" };
  }
  const id = parseId(e, rawId);
  if (id == null) return { ok: false, message: "Identifiant invalide" };
  const db = delegate(e);
  const row = await db.findUnique({ where: { id } });
  if (!row) return { ok: false, message: "Introuvable" };
  if (e.key === "users" && admin.uid === String(id)) return { ok: false, message: "Vous ne pouvez pas supprimer votre propre compte" };
  const block = e.canDelete ? await e.canDelete(row) : null;
  if (block) return { ok: false, message: block };
  await db.delete({ where: { id } });
  await audit(admin, "delete", e.key, id, String(row.label ?? row.name ?? row.title ?? row.code ?? row.email ?? row.from ?? "").slice(0, 120));
  await post(e);
  redirect(`/admin/m/${e.key}?deleted=1`);
}
