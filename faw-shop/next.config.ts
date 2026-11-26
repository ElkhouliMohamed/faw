import type { NextConfig } from "next";

/** Origines autorisées pour les Server Actions (en plus de l'hôte courant) : tunnel d'aperçu + liste env. */
const extraOrigins = (process.env.SERVER_ACTIONS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  // Métadonnées toujours dans <head> (pas de streaming) : description/canonical lisibles par tous les outils SEO.
  htmlLimitedBots: /.*/,
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  experimental: {
    // Protection CSRF native de Next (Origin == Host) ; tunnels d'aperçu autorisés explicitement.
    serverActions: {
      allowedOrigins: ["*.trycloudflare.com", "*.ngrok-free.dev", ...extraOrigins],
      bodySizeLimit: "6mb", // upload photo produit (5 Mo max, vérifié côté serveur)
    },
  },
  // Anciennes URL (site Framer faw.ma + variantes) -> nouvelles pages, en 301.
  async redirects() {
    const r = (source: string, destination: string) => ({ source, destination, statusCode: 301 as const });
    return [
      r("/portes", "/produits?categorie=portes-coupe-feu"),
      r("/portes/:path*", "/produits?categorie=portes-coupe-feu"),
      r("/moteurs", "/produits?categorie=automatisme"),
      r("/moteurs/:path*", "/produits?categorie=automatisme"),
      r("/contact-us", "/contact"),
      r("/projects", "/"),
      r("/projects/:path*", "/"),
      r("/produit/:slug", "/produits/:slug"),
      r("/products/:slug", "/produits/:slug"),
      r("/products", "/produits"),
      r("/boutique", "/produits"),
      r("/shop", "/produits"),
    ];
  },
  async rewrites() {
    const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
    return { beforeFiles: [
      ...["admin", "livewire", "filament", "css/filament", "js/filament", "fonts/filament", "storage", "api"].flatMap((prefix) => [
        { source: `/${prefix}`, destination: `${origin}/${prefix}` },
        { source: `/${prefix}/:path*`, destination: `${origin}/${prefix}/:path*` },
      ]),
    ], afterFiles: [], fallback: [] };
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      { source: "/admin", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/devis/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
      ...["/devis/suivi/:path*", "/devis/pdf/:path*", "/devis/confirmation/:path*"].map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }, { key: "Referrer-Policy", value: "no-referrer" }],
      })),
      { source: "/media/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ];
  },
};

export default nextConfig;
