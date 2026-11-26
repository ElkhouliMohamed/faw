import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
const resolvedRedirect = z.object({ to: z.string().regex(/^\/(?!\/)/), code: z.union([z.literal(301), z.literal(302)]) });
async function matchRedirect(pathname: string) {
  try {
    const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
    const response = await fetch(`${origin}/api/redirects/resolve?path=${encodeURIComponent(pathname)}`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (response.status !== 200) return null;
    return resolvedRedirect.parse(await response.json());
  } catch { return null; }
}

/**
 * - 301 : /produits/CF-EI60-80 (toute casse) -> /produits/cf-ei60-80.
 * - ?lang=ar|fr : URL alternative (hreflang) -> langue transmise au rendu via un en-tête interne.
 * - Content-Security-Policy avec nonce par requête (scripts inline de Next autorisés par nonce, pas d'unsafe-eval en prod).
 */
// Liens privés (/devis/suivi, /devis/pdf, /devis/confirmation, /commande/confirmation) : limitation de débit par IP (mémoire du processus).
const privateHits = new Map<string, number[]>();
function privateLinkAllowed(req: NextRequest) {
  const xff = req.headers.get("x-forwarded-for");
  const hops = (xff ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = (hops.length ? (process.env.TRUST_PROXY === "0" ? hops[0] : hops[hops.length - 1]) : req.headers.get("x-real-ip") || "local").slice(0, 64);
  const max = Number(process.env.QUOTE_LINK_RATE_LIMIT) > 0 ? Number(process.env.QUOTE_LINK_RATE_LIMIT) : 60;
  const win = 10 * 60_000;
  const now = Date.now();
  const arr = (privateHits.get(ip) ?? []).filter((t) => now - t < win);
  const ok = arr.length < max;
  if (ok) arr.push(now);
  privateHits.set(ip, arr);
  if (privateHits.size > 5000) for (const [k, v] of privateHits) if (!v.some((t) => now - t < win)) privateHits.delete(k);
  return ok;
}
const PRIVATE_QUOTE = /^\/(?:devis\/(?:suivi|pdf|confirmation)|commande\/confirmation)\//;

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (/^\/(admin|livewire|filament|storage|api)(\/|$)/.test(pathname) || /^\/(css|js|fonts)\/filament(\/|$)/.test(pathname)) {
    // Next otherwise supplies its listening port (3100) even when HTTPS terminates at the preview proxy.
    // Forward the browser-facing authority, not the internal Laravel/Next address.
    const forwarded = new Headers(req.headers);
    const protocol = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ? "https" : req.nextUrl.protocol.replace(":", "");
    const publicOrigin = new URL(`${protocol}://${req.headers.get("host") || req.nextUrl.host}`);
    forwarded.set("x-forwarded-host", publicOrigin.host);
    forwarded.set("x-forwarded-proto", publicOrigin.protocol.replace(":", ""));
    forwarded.set("x-forwarded-port", publicOrigin.port || (publicOrigin.protocol === "https:" ? "443" : "80"));
    return NextResponse.next({ request: { headers: forwarded } });
  }
  const privateQuote = PRIVATE_QUOTE.test(pathname);
  if (privateQuote && !privateLinkAllowed(req))
    return new NextResponse("Trop de requêtes. Réessayez dans quelques minutes.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  // Redirections SEO du back-office (hors back-office, API et liens privés).
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/api/") && !privateQuote) {
    const r = await matchRedirect(pathname);
    if (r) {
      if (/^https:\/\//.test(r.to)) return NextResponse.redirect(new URL(r.to), r.code);
      const rel = new URL(r.to, "http://x");
      const url = req.nextUrl.clone();
      url.pathname = rel.pathname;
      url.search = rel.search || search;
      return NextResponse.redirect(url, r.code);
    }
  }
  const m = pathname.match(/^\/produits\/([^/]+)\/?$/);
  if (m) {
    let lower = m[1];
    try {
      lower = decodeURIComponent(m[1]).toLowerCase();
    } catch {}
    const target = `/produits/${lower}`;
    if (target !== pathname) {
      const url = req.nextUrl.clone();
      url.pathname = target;
      url.search = search;
      return NextResponse.redirect(url, 301);
    }
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const https = req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:";
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com https://connect.facebook.net${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://*.facebook.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://ad.doubleclick.net https://www.google.com https://www.google.fr https://www.google.ca`,
    `font-src 'self' data:`,
    `connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://*.facebook.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://stats.g.doubleclick.net https://ad.doubleclick.net https://www.google.com${dev ? " ws:" : ""}`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `manifest-src 'self'`,
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.delete("x-faw-locale");
  const lang = req.nextUrl.searchParams.get("lang");
  if (lang === "ar" || lang === "fr") reqHeaders.set("x-faw-locale", lang);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  // Une URL ?lang=ar|fr fixe aussi le cookie : la langue reste cohérente quand le paramètre disparaît
  // (filtres boutique, liens internes) et le bouton de langue peut ensuite la changer.
  if ((lang === "ar" || lang === "fr") && req.cookies.get("faw-locale")?.value !== lang) {
    res.cookies.set("faw-locale", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }
  res.headers.set("Content-Security-Policy", csp);
  if (privateQuote) {
    res.headers.set("Cache-Control", "private, no-store, max-age=0");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    res.headers.set("Referrer-Policy", "no-referrer");
  }
  return res;
}

export const config = {
  runtime: "nodejs",
  matcher: [
    {
      source: "/((?!_next/static|_next/image|images/|media/|favicon|icon|apple-icon|og\\.jpg|robots\\.txt|sitemap\\.xml).*)",
      missing: [{ type: "header", key: "next-router-prefetch" }],
    },
  ],
};
