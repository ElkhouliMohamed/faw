import "server-only";
import { currentAdmin, type AdminIdentity } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { levelFor, MODULES, permKey, type Level, type PermMatrix } from "./modules";

export class PermissionError extends Error {}

export async function permMatrix() {
  return getSetting<PermMatrix>("rbac", {});
}
export async function levelOf(admin: AdminIdentity | null, perm: string): Promise<Level> {
  if (!admin) return "none";
  return levelFor(admin.role, perm, await permMatrix());
}
/** Modules visibles (lecture au moins) pour la navigation. */
export async function visibleModules(admin: AdminIdentity) {
  const m = await permMatrix();
  return MODULES.filter((x) => levelFor(admin.role, permKey(x), m) !== "none").map((x) => ({ ...x, write: levelFor(admin.role, permKey(x), m) === "write" }));
}
/** Pages : null si non connecté ou sans droit de lecture (rien n'est rendu ni sérialisé). */
export async function pageAccess(perm: string): Promise<{ admin: AdminIdentity; write: boolean } | null> {
  const admin = await currentAdmin();
  if (!admin) return null;
  const lvl = await levelOf(admin, perm);
  if (lvl === "none") return null;
  return { admin, write: lvl === "write" };
}
/** Server actions : exige le droit d'écriture sur le module. */
export async function requireWrite(perm: string): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin) throw new PermissionError("Non autorisé");
  if ((await levelOf(admin, perm)) !== "write") throw new PermissionError("Droits insuffisants pour ce module");
  return admin;
}
export async function requireRead(perm: string): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin || (await levelOf(admin, perm)) === "none") throw new PermissionError("Non autorisé");
  return admin;
}

export const actorLabel = (a: AdminIdentity | null) => (a ? (a.owner ? "propriétaire" : `${a.name} <${a.email}>`) : "anonyme");

/** Journal d'audit (jamais de secret ni de mot de passe dans le résumé). */
export async function audit(a: AdminIdentity | null, action: string, entity: string, entityId?: string | number | null, summary?: string) {
  try {
    await prisma.auditLog.create({
      data: { actor: actorLabel(a).slice(0, 160), action, entity, entityId: entityId == null ? null : String(entityId).slice(0, 80), summary: summary?.slice(0, 500) },
    });
  } catch {}
}
