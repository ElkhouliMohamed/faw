import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { prisma } from "./db";
import type { Role } from "./admin/modules";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Authentification back-office :
// - ADMIN_PASSWORD_HASH (scrypt, voir scripts/hash-password.mjs) prioritaire, sinon ADMIN_PASSWORD (comparaison à temps constant) ;
// - session signée (HMAC) avec expiration, cookie httpOnly SameSite=Strict, Secure en HTTPS, limité à /admin ;
// - verrouillage temporaire après plusieurs échecs (par IP).

export const ADMIN_COOKIE = "faw-admin";
const SESSION_HOURS = () => Math.min(24, Math.max(1, Number(process.env.ADMIN_SESSION_HOURS) || 8));

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD || "";
}
/** Empreinte du mot de passe configuré : changer le mot de passe invalide les sessions. */
function credentialFingerprint() {
  const src = process.env.ADMIN_PASSWORD_HASH || process.env.ADMIN_PASSWORD || "";
  return createHash("sha256").update(src).digest("base64url").slice(0, 16);
}
export function adminConfigured() {
  // The only back-office authentication is now Laravel / Filament. Legacy cookies cannot grant access.
  return false;
}

function safeEqual(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Format : scrypt:N:r:p:saltB64:hashB64 (« : » plutôt que « $ », non interprété par dotenv) */
export function verifyScrypt(input: string, stored: string) {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  try {
    const got = scryptSync(input, Buffer.from(salt, "base64"), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: 256 * 1024 * 1024 });
    return safeEqual(got, expected);
  } catch {
    return false;
  }
}

/** Hachage scrypt (même format que scripts/hash-password.mjs). */
export function hashPassword(pw: string) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64")}:${hash.toString("base64")}`;
}

export function checkPassword(input: string) {
  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (hash) return verifyScrypt(input, hash);
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  // Empreintes de longueur fixe : pas de fuite de longueur par le temps de comparaison.
  return safeEqual(createHash("sha256").update(input).digest(), createHash("sha256").update(pw).digest());
}

/* ---------- Sessions ---------- */
// Jeton v3 : v3.expiration.idSession.utilisateur.empreinte.signature
// utilisateur = « o » (propriétaire, ADMIN_PASSWORD) ou id AdminUser. Empreinte : changer le mot de passe invalide les sessions.
const revoked = new Map<string, number>(); // id de session -> expiration

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}
export const userFingerprint = (passwordHash: string) => createHash("sha256").update(`u:${passwordHash}`).digest("base64url").slice(0, 16);

export function createSessionToken(user?: { id: number; passwordHash: string }) {
  if (!adminConfigured() || !sessionSecret()) return null;
  const exp = Date.now() + SESSION_HOURS() * 3600_000;
  const id = randomBytes(12).toString("base64url");
  const uid = user ? String(user.id) : "o";
  const fp = user ? userFingerprint(user.passwordHash) : credentialFingerprint();
  const payload = `v3.${exp}.${id}.${uid}.${fp}`;
  return { token: `${payload}.${sign(payload)}`, maxAge: SESSION_HOURS() * 3600 };
}
function parseSession(token: string | undefined) {
  if (!token || !adminConfigured()) return null;
  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v3") return null;
  const payload = parts.slice(0, 5).join(".");
  if (!safeEqual(Buffer.from(parts[5]), Buffer.from(sign(payload)))) return null;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  if (revoked.has(parts[2])) return null;
  const uid = parts[3];
  if (uid !== "o" && !/^\d{1,9}$/.test(uid)) return null;
  return { id: parts[2], exp, uid, fp: parts[4] };
}

export type AdminIdentity = { uid: string; name: string; email: string | null; role: Role; owner: boolean };

/** Utilisateur connecté (propriétaire ou compte AdminUser actif), mis en cache pour la requête. */
export const currentAdmin = cache(async (): Promise<AdminIdentity | null> => {
  const s = parseSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!s) return null;
  if (s.uid === "o") {
    if (s.fp !== credentialFingerprint()) return null;
    return { uid: "o", name: "Propriétaire", email: null, role: "admin", owner: true };
  }
  const u = await prisma.adminUser.findUnique({ where: { id: Number(s.uid) } });
  if (!u || !u.active || userFingerprint(u.passwordHash) !== s.fp) return null;
  const role = (["admin", "manager", "viewer"] as const).includes(u.role as Role) ? (u.role as Role) : "viewer";
  return { uid: String(u.id), name: u.name, email: u.email, role, owner: false };
});

export async function isAdmin() {
  return !!(await currentAdmin());
}
export async function revokeCurrentSession() {
  const s = parseSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (s) revoked.set(s.id, s.exp);
  const now = Date.now();
  for (const [k, exp] of revoked) if (exp < now) revoked.delete(k);
}
export async function cookieSecure() {
  const h = await headers();
  return h.get("x-forwarded-proto") === "https" || process.env.ADMIN_COOKIE_SECURE === "1";
}

/* ---------- Verrouillage après échecs ---------- */
const failures = new Map<string, { count: number; first: number; lockedUntil: number }>();
const MAX_FAILS = () => Number(process.env.ADMIN_MAX_FAILS) || 5;
const LOCK_MS = () => (Number(process.env.ADMIN_LOCK_MINUTES) || 15) * 60_000;
const WINDOW_MS = 15 * 60_000;

export const MAX_FAILS_COUNT = MAX_FAILS;
export const LOCK_DURATION_MS = LOCK_MS;
export function lockRemainingMs(key: string) {
  const f = failures.get(key);
  if (!f) return 0;
  return Math.max(0, f.lockedUntil - Date.now());
}
export function recordFailure(key: string) {
  const now = Date.now();
  let f = failures.get(key);
  if (!f || now - f.first > WINDOW_MS) f = { count: 0, first: now, lockedUntil: 0 };
  f.count += 1;
  if (f.count >= MAX_FAILS()) {
    f.lockedUntil = now + LOCK_MS();
    f.count = 0;
    f.first = now;
  }
  failures.set(key, f);
  if (failures.size > 5000) for (const [k, v] of failures) if (v.lockedUntil < now && now - v.first > WINDOW_MS) failures.delete(k);
}
export function clearFailures(key: string) {
  failures.delete(key);
}
