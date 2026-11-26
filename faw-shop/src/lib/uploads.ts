import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "data", "uploads"));
}
export const safeUploadName = (f: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(f);

function magicOk(b: Buffer) {
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const webp = b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return jpeg || png || webp;
}

/**
 * Photo produit : JPEG / PNG / WebP, 5 Mo max, signature vérifiée, ré-encodée en WebP
 * (supprime métadonnées et tout contenu non image), nom aléatoire. Jamais d'exécutable.
 */
export async function saveProductImage(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!file || file.size === 0) return { ok: false, error: "Aucune photo" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Photo trop lourde (5 Mo maximum)" };
  if (!ALLOWED.has(file.type)) return { ok: false, error: "Format refusé : JPEG, PNG ou WebP uniquement" };
  if (/\.(exe|sh|bat|cmd|js|mjs|php|py|svg|html?)$/i.test(file.name)) return { ok: false, error: "Type de fichier refusé" };
  const buf = Buffer.from(await file.arrayBuffer());
  if (!magicOk(buf)) return { ok: false, error: "Le fichier n'est pas une image valide" };
  let out: Buffer;
  try {
    out = await sharp(buf, { limitInputPixels: 40_000_000 }).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    return { ok: false, error: "Image illisible" };
  }
  const name = `${randomUUID()}.webp`;
  await mkdir(uploadDir(), { recursive: true, mode: 0o750 });
  await writeFile(path.join(uploadDir(), name), out, { mode: 0o640 });
  return { ok: true, url: `/media/${name}` };
}

export async function readUpload(name: string) {
  if (!safeUploadName(name)) return null;
  try {
    return await readFile(path.join(uploadDir(), name));
  } catch {
    return null;
  }
}
