import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { CACHE_TAGS } from "@/lib/shop-api";
import { clearRedirectCache } from "@/lib/redirect-cache";

/**
 * Revalidation à la demande, appelée par Laravel (App\Services\StorefrontCache) après une modification dans Filament.
 * POST { tags: ["catalog", ...] } avec l'en-tête x-faw-revalidate-secret = REVALIDATE_SECRET (32 caractères minimum).
 * Sans secret configuré, la route répond 404 : la boutique se met alors à jour à l'expiration du cache.
 */
export const dynamic = "force-dynamic";

const body = z.object({ tags: z.array(z.enum(CACHE_TAGS)).min(1).max(CACHE_TAGS.length) });
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

function authorized(given: string | null) {
  const secret = process.env.REVALIDATE_SECRET?.trim() ?? "";
  if (secret.length < 32 || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!process.env.REVALIDATE_SECRET) return NextResponse.json({ ok: false }, { status: 404, headers });
  if (!authorized(req.headers.get("x-faw-revalidate-secret"))) return NextResponse.json({ ok: false }, { status: 401, headers });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 422, headers });
  const tags = [...new Set(parsed.data.tags)];
  for (const tag of tags) revalidateTag(tag);
  if (tags.includes("redirects")) clearRedirectCache();
  return NextResponse.json({ ok: true, tags }, { headers });
}

export function GET() {
  return NextResponse.json({ ok: false }, { status: 405, headers: { ...headers, Allow: "POST" } });
}
