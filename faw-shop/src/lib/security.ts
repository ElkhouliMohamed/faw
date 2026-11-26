import "server-only";
import { headers } from "next/headers";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Protections applicatives : IP client, limitation de débit, anti-spam des formulaires publics.
// Aucune donnée personnelle n'est journalisée.

const PROCESS_SECRET = randomBytes(32).toString("hex");
function secret() {
  return process.env.FORM_SECRET || PROCESS_SECRET;
}

/** IP du client. Derrière un proxy de confiance (TRUST_PROXY=1), dernier saut de X-Forwarded-For. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const ip = process.env.TRUST_PROXY === "0" ? hops[0] : hops[hops.length - 1];
    if (ip) return ip.slice(0, 64);
  }
  return (h.get("x-real-ip") || "local").slice(0, 64);
}

/* ---------- Limitation de débit (mémoire, fenêtre glissante) ---------- */
const buckets = new Map<string, number[]>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) {
    buckets.set(key, arr);
    return false;
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 5000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}
function envInt(name: string, def: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : def;
}
/** Limite des formulaires publics (commande, devis, assistant) par IP. */
export async function publicFormAllowed(scope: string) {
  const ip = await clientIp();
  return rateLimit(`${scope}:${ip}`, envInt("FORM_RATE_LIMIT", 8), envInt("FORM_RATE_WINDOW_MS", 10 * 60_000));
}

/* ---------- Jeton de formulaire signé (temps de remplissage minimum) ---------- */
const MIN_FILL_MS = () => envInt("FORM_MIN_FILL_MS", 3000);
const MAX_AGE_MS = 24 * 3600_000;

export function issueFormToken(now = Date.now()) {
  const ts = String(now);
  const sig = createHmac("sha256", secret()).update(`form:${ts}`).digest("base64url");
  return `${ts}.${sig}`;
}
export function checkFormToken(token: unknown, now = Date.now()): "ok" | "fast" | "invalid" {
  if (typeof token !== "string") return "invalid";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d{10,15}$/.test(ts)) return "invalid";
  const expected = createHmac("sha256", secret()).update(`form:${ts}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return "invalid";
  const age = now - Number(ts);
  if (age < MIN_FILL_MS()) return "fast";
  if (age > MAX_AGE_MS) return "invalid";
  return "ok";
}

/** Champ piège : nom anodin, masqué aux humains. Rempli => robot. */
export const HONEYPOT_FIELD = "website";

export type SpamVerdict = { ok: true } | { ok: false; reason: "honeypot" | "token" | "rate"; message: string };

/** Vérifications anti-spam communes à tous les formulaires publics. */
export async function spamCheck(fd: FormData, scope: string): Promise<SpamVerdict> {
  if (String(fd.get(HONEYPOT_FIELD) ?? "").trim()) return { ok: false, reason: "honeypot", message: "Votre demande n'a pas pu être envoyée." };
  const tok = checkFormToken(fd.get("formToken"));
  if (tok !== "ok")
    return { ok: false, reason: "token", message: tok === "fast" ? "Merci de vérifier votre saisie puis de renvoyer le formulaire." : "Formulaire expiré : rechargez la page puis réessayez." };
  if (!(await publicFormAllowed(scope))) return { ok: false, reason: "rate", message: "Trop de demandes depuis votre connexion. Réessayez dans quelques minutes ou écrivez-nous sur WhatsApp." };
  return { ok: true };
}
