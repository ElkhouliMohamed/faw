"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit, PermissionError, requireWrite } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { cleanAlt, mediaUsage, removeMediaFile, storeMedia } from "@/lib/media";

export type MediaState = { ok: boolean; message: string } | null;
const deny = (x: unknown): MediaState => ({ ok: false, message: x instanceof PermissionError ? x.message : "Non autorisé" });

export async function uploadMedia(_p: MediaState, fd: FormData): Promise<MediaState> {
  let admin;
  try {
    admin = await requireWrite("media");
  } catch (x) {
    return deny(x);
  }
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { ok: false, message: "Choisissez au moins une image" };
  if (files.length > 10) return { ok: false, message: "10 images maximum par envoi" };
  const alt = String(fd.get("alt") ?? "");
  const errors: string[] = [];
  let n = 0;
  for (const f of files) {
    const r = await storeMedia(f, alt);
    if (r.ok) {
      n++;
      await audit(admin, "upload", "media", r.media.id, r.media.url);
    } else errors.push(`${f.name.slice(0, 60)} : ${r.error}`);
  }
  revalidatePath("/admin/medias");
  return { ok: errors.length === 0, message: `${n} image(s) ajoutée(s)${errors.length ? ` — refusé : ${errors.join(" ; ")}` : ""}` };
}

export async function updateMediaAlt(_p: MediaState, fd: FormData): Promise<MediaState> {
  let admin;
  try {
    admin = await requireWrite("media");
  } catch (x) {
    return deny(x);
  }
  const id = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Identifiant invalide" };
  await prisma.media.update({ where: { id: id.data }, data: { alt: cleanAlt(String(fd.get("alt") ?? "")) } });
  await audit(admin, "update", "media", id.data, "texte alternatif");
  revalidatePath("/admin/medias");
  return { ok: true, message: "Enregistré" };
}

export async function deleteMedia(_p: MediaState, fd: FormData): Promise<MediaState> {
  let admin;
  try {
    admin = await requireWrite("media");
  } catch (x) {
    return deny(x);
  }
  const id = z.coerce.number().int().positive().safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Identifiant invalide" };
  const m = await prisma.media.findUnique({ where: { id: id.data } });
  if (!m) return { ok: false, message: "Introuvable" };
  const used = await mediaUsage(m.url);
  if (used.length) return { ok: false, message: `Image utilisée (${used.slice(0, 5).join(", ")}) : retirez-la d'abord.` };
  await prisma.media.delete({ where: { id: m.id } });
  await removeMediaFile(m.file);
  await audit(admin, "delete", "media", m.id, m.url);
  revalidatePath("/admin/medias");
  return { ok: true, message: "Supprimée" };
}
