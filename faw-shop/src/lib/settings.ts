import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";

// Réglages clé/valeur (JSON) en base. Les secrets sont chiffrés AES-256-GCM (clé SETTINGS_ENCRYPTION_KEY,
// sinon dérivée de ADMIN_SESSION_SECRET) et ne sont JAMAIS renvoyés au navigateur (champs en écriture seule).

const store = globalThis as unknown as { __fawSettings?: Map<string, unknown> };
const cacheMap = () => (store.__fawSettings ??= new Map());

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const c = cacheMap();
  if (c.has(key)) return c.get(key) as T;
  const row = await prisma.setting.findUnique({ where: { key } });
  let v: T = fallback;
  if (row) {
    try {
      v = { ...(fallback as object), ...JSON.parse(row.value) } as T;
      if (Array.isArray(fallback)) v = JSON.parse(row.value) as T;
    } catch {}
  }
  c.set(key, v);
  return v;
}
export async function setSetting(key: string, value: unknown, by?: string) {
  const json = JSON.stringify(value);
  await prisma.setting.upsert({ where: { key }, create: { key, value: json, updatedBy: by }, update: { value: json, updatedBy: by } });
  cacheMap().delete(key);
}
export function invalidateSettings() {
  cacheMap().clear();
}

/* ---------- Secrets chiffrés ---------- */
function key() {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY || process.env.ADMIN_SESSION_SECRET || "";
  if (!raw) return null;
  return createHash("sha256").update(`faw-settings:${raw}`).digest();
}
export function secretsAvailable() {
  return !!key();
}
export function encryptSecret(plain: string) {
  const k = key();
  if (!k) throw new Error("Chiffrement indisponible : définir SETTINGS_ENCRYPTION_KEY");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `gcm:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}
export function decryptSecret(stored: string | undefined | null): string | null {
  if (!stored) return null;
  const k = key();
  const [tag0, iv, tag, data] = stored.split(":");
  if (!k || tag0 !== "gcm" || !iv || !tag || !data) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", k, Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(data, "base64")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
