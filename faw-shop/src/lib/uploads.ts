import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Photos historiques (/media/<uuid>.webp) envoyées par l'ancien back-office Next : lecture seule.
// Les nouveaux médias sont gérés par Filament et servis par Laravel (/storage/…).
export function uploadDir() {
  return path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "data", "uploads"));
}
export const safeUploadName = (f: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/.test(f);

export async function readUpload(name: string) {
  if (!safeUploadName(name)) return null;
  try {
    return await readFile(path.join(uploadDir(), name));
  } catch {
    return null;
  }
}
