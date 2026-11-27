import "server-only";
import { headers } from "next/headers";
import { SITE, socialLinks } from "./site";
import { publicConfig } from "./public-config";
import type { Faq } from "./products";

/** Langue demandée par l'URL (?lang=ar) — sert aux canonical/hreflang (indépendant du cookie). */
export async function urlLocale(): Promise<"fr" | "ar"> {
  return (await headers()).get("x-faw-locale") === "ar" ? "ar" : "fr";
}

/** Origine canonique (réglage SEO Filament, sinon NEXT_PUBLIC_SITE_URL). */
export async function siteOrigin() {
  return ((await publicConfig())?.seo.canonicalBase || SITE.url).replace(/\/$/, "");
}

/**
 * canonical + hreflang fr/ar (+ x-default), en URL absolues : chaque version se déclare canonique
 * et les deux se citent mutuellement (plus de canonical FR sur la page ?lang=ar). Les URL absolues
 * évitent aussi que Next supprime « ?lang=ar » sur la racine.
 */
export async function alternates(path: string) {
  const origin = await siteOrigin();
  const cleanPath = path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  const ar = (await urlLocale()) === "ar";
  const frUrl = `${origin}/fr${cleanPath}`;
  const arUrl = `${origin}/ar${cleanPath}`;
  return {
    canonical: ar ? arUrl : frUrl,
    languages: {
      "fr-MA": frUrl,
      "ar-MA": arUrl,
      "fr": frUrl,
      "ar": arUrl,
      "x-default": frUrl,
    },
  };
}

/** Page non indexable : canonical vers elle-même, pas de hreflang. */
export async function noindexMeta(path: string, title: string, description: string) {
  return { title, description, alternates: { canonical: `${await siteOrigin()}${path}` }, robots: { index: false, follow: true } };
}

export async function nonce() {
  return (await headers()).get("x-nonce") ?? undefined;
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: `${SITE.url}${it.path}` })),
  };
}

export function faqLd(faq: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Organization + LocalBusiness (dépôt Casablanca), sur toutes les pages. */
export function organizationLd(showPrices = false) {
  const sameAs = [SITE.facebookUrl, ...socialLinks().map((s) => s.url)];
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${SITE.url}/#organisation`,
    name: SITE.name,
    slogan: SITE.tagline,
    url: SITE.url,
    logo: `${SITE.url}/icon.png`,
    image: `${SITE.url}/og.jpg`,
    telephone: SITE.phone,
    email: SITE.email,
    ...(showPrices ? { priceRange: "DH", currenciesAccepted: "MAD" } : {}),
    paymentAccepted: "Virement bancaire, chèque",
    address: { "@type": "PostalAddress", streetAddress: "21 Rue Al Yazidi Mohamed", addressLocality: "Casablanca", addressCountry: "MA" },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "17:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "12:00" },
    ],
    contactPoint: [{ "@type": "ContactPoint", telephone: `+${SITE.whatsappNumber}`, contactType: "customer service", availableLanguage: ["French", "Arabic"] }],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

/** JSON-LD sûr dans un <script> (échappe « < »). */
export function ldJson(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
