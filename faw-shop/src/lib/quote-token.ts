import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "./db";
import { QUOTE_TOKEN_RE } from "./devis";

/** sha256 hex of a raw private-link token (same as Laravel Quote::hashToken). */
export function hashQuoteToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Active private link only: right format, known hash, not revoked, not expired.
 * Laravel owns the hash, expiry and revocation; the raw token is never stored nor logged here.
 */
export async function findQuoteByToken(raw: string) {
  if (!QUOTE_TOKEN_RE.test(raw)) return null;
  const q = await prisma.quote.findUnique({ where: { tokenHash: hashQuoteToken(raw) } });
  if (!q || q.tokenRevokedAt) return null;
  if (!q.tokenExpiresAt || q.tokenExpiresAt.getTime() <= Date.now()) return null;
  return q;
}
