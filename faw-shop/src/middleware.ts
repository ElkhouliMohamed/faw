import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cachedRedirect, rememberRedirect } from "@/lib/redirect-cache";

const resolvedRedirect = z.object({ to: z.string().regex(/^\/(?!\/)/), code: z.union([z.literal(301), z.literal(302)]) });

/** Redirection SEO du back-office ; réponse gardée 60 s en mémoire, vidée par /revalidate. */
async function matchRedirect(pathname: string) {
  const known = cachedRedirect(pathname);
  if (known !== undefined) return known;
  try {
    const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
    const response = await fetch(`${origin}/api/redirects/resolve?path=${encodeURIComponent(pathname)}`, { cache: "no-store", signal: AbortSignal.timeout(1500) });
    if (response.status === 204) {
      rememberRedirect(pathname, null);
      return null;
    }
    if (response.status !== 200) return null;
    const hit = resolvedRedirect.parse(await response.json());
    rememberRedirect(pathname, hit);
    return hit;
  } catch { return null; }
}

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

const PRIVATE_QUOTE = /^\/(?:(?:fr|ar)\/)?(?:devis\/(?:suivi|pdf|confirmation)|commande\/confirmation)\//;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pass-through routes (Laravel API/admin/storage, static assets, revalidation)
  if (/^\/(admin|livewire|filament|storage|api|revalidate)(\/|$)/.test(pathname) || /^\/(css|js|fonts)\/filament(\/|$)/.test(pathname)) {
    const forwarded = new Headers(req.headers);
    const protocol = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https" ? "https" : req.nextUrl.protocol.replace(":", "");
    const publicOrigin = new URL(`${protocol}://${req.headers.get("host") || req.nextUrl.host}`);
    forwarded.set("x-forwarded-host", publicOrigin.host);
    forwarded.set("x-forwarded-proto", publicOrigin.protocol.replace(":", ""));
    forwarded.set("x-forwarded-port", publicOrigin.port || (publicOrigin.protocol === "https:" ? "443" : "80"));
    return NextResponse.next({ request: { headers: forwarded } });
  }

  const privateQuote = PRIVATE_QUOTE.test(pathname);
  if (privateQuote && !privateLinkAllowed(req)) {
    return new NextResponse("Trop de requêtes. Réessayez dans quelques minutes.", {
      status: 429,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "600", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
    });
  }

  // Detect language prefix /fr or /ar
  let locale: "fr" | "ar" = "fr";
  let internalPath = pathname;
  let hasLocalePrefix = false;

  if (pathname === "/ar" || pathname.startsWith("/ar/")) {
    locale = "ar";
    internalPath = pathname.slice(3) || "/";
    hasLocalePrefix = true;
  } else if (pathname === "/fr" || pathname.startsWith("/fr/")) {
    locale = "fr";
    internalPath = pathname.slice(3) || "/";
    hasLocalePrefix = true;
  }

  // If a ?lang=ar or ?lang=fr query parameter explicitly overrides the current prefix:
  const queryLang = req.nextUrl.searchParams.get("lang");
  if ((queryLang === "ar" || queryLang === "fr") && hasLocalePrefix && queryLang !== locale) {
    const url = req.nextUrl.clone();
    url.pathname = `/${queryLang}${internalPath === "/" ? "" : internalPath}`;
    url.searchParams.delete("lang");
    const res = NextResponse.redirect(url, 307);
    res.cookies.set("faw-locale", queryLang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  // If there is no prefix (/ or /produits ...), redirect to the localized URL prefix
  if (!hasLocalePrefix) {
    const target = queryLang === "ar" || (!queryLang && req.cookies.get("faw-locale")?.value === "ar") ? "ar" : "fr";
    const url = req.nextUrl.clone();
    url.pathname = `/${target}${pathname === "/" ? "" : pathname}`;
    url.searchParams.delete("lang");
    const res = NextResponse.redirect(url, 307);
    res.cookies.set("faw-locale", target, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  // SEO redirects from back office
  if (!privateQuote) {
    const r = await matchRedirect(internalPath);
    if (r) {
      if (/^https?:\/\//.test(r.to)) return NextResponse.redirect(new URL(r.to), r.code);
      const url = req.nextUrl.clone();
      const cleanTo = r.to.startsWith("/") ? r.to : `/${r.to}`;
      url.pathname = `/${locale}${cleanTo === "/" ? "" : cleanTo}`;
      return NextResponse.redirect(url, r.code);
    }
  }

  // Normaliser la casse sur les produits
  const m = internalPath.match(/^\/produits\/([^/]+)\/?$/);
  if (m) {
    let lower = m[1];
    try {
      lower = decodeURIComponent(m[1]).toLowerCase();
    } catch {}
    const target = `/produits/${lower}`;
    if (target !== internalPath) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale}${target}`;
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
  reqHeaders.set("x-faw-locale", locale);
  reqHeaders.set("x-faw-path", internalPath);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);

  const rewriteUrl = req.nextUrl.clone();
  rewriteUrl.pathname = internalPath;
  const res = NextResponse.rewrite(rewriteUrl, { request: { headers: reqHeaders } });
  res.cookies.set("faw-locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
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
    "/((?!_next/static|_next/image|images/|media/|favicon|icon|apple-icon|og\\.jpg|robots\\.txt|sitemap\\.xml).*)",
  ],
};
