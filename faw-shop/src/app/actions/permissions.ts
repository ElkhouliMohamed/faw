"use server";
import { revalidatePath } from "next/cache";
import { actorLabel, audit, PermissionError, requireWrite } from "@/lib/admin/perm";
import { defaultLevel, PERM_KEYS, type Level, type PermMatrix } from "@/lib/admin/modules";
import { setSetting } from "@/lib/settings";

const LEVELS: Level[] = ["none", "read", "write"];

export async function savePermissions(_p: { ok: boolean; message: string } | null, fd: FormData) {
  let admin;
  try {
    admin = await requireWrite("users");
  } catch (x) {
    return { ok: false, message: x instanceof PermissionError ? x.message : "Non autorisé" };
  }
  const m: PermMatrix = { manager: {}, viewer: {} };
  for (const role of ["manager", "viewer"] as const) {
    for (const k of PERM_KEYS) {
      if (k === "users") continue;
      const v = String(fd.get(`${role}.${k}`) ?? "");
      if (!LEVELS.includes(v as Level)) continue;
      if (role === "viewer" && v === "write") return { ok: false, message: "Le rôle « Lecture seule » ne peut pas avoir l'écriture" };
      if (v !== defaultLevel(role, k)) m[role]![k] = v as Level;
    }
  }
  await setSetting("rbac", m, actorLabel(admin));
  await audit(admin, "update", "permissions", null, `${Object.keys(m.manager!).length + Object.keys(m.viewer!).length} exception(s)`);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Permissions enregistrées" };
}
