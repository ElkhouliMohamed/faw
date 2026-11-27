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
    paymentAccepted: "Virement bancaire, chèque, carte bancaire, espèces",
    address: { "@type": "PostalAddress", streetAddress: "21 Rue Al Yazidi Mohamed", addressLocality: "Casablanca", postalCode: "20250", addressRegion: "Grand Casablanca", addressCountry: "MA" },
    geo: { "@type": "GeoCoordinates", latitude: SITE.geo.lat, longitude: SITE.geo.lng },
    openingHoursSpecification: [
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "09:00", closes: "17:00" },
      { "@type": "OpeningHoursSpecification", dayOfWeek: "Saturday", opens: "09:00", closes: "12:00" },
    ],
    contactPoint: [{ "@type": "ContactPoint", telephone: `+${SITE.whatsappNumber}`, contactType: "customer service", availableLanguage: ["French", "Arabic"] }],
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export type ProductLdInput = {
  id: string;
  title: string;
  description?: string;
  image?: string;
  price?: number;
  available?: boolean;
  slug: string;
  category?: string;
  showPrices?: boolean;
};

/** Product + Offer JSON-LD schema (Offer included only when product has a price and prices are visible). */
export function productLd(p: ProductLdInput) {
  const hasPrice = p.showPrices && p.price != null && p.price > 0;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE.url}/produits/${p.slug}#product`,
    name: p.title,
    sku: p.id,
    description: p.description || undefined,
    image: p.image ? (p.image.startsWith("http") ? p.image : `${SITE.url}${p.image}`) : undefined,
    category: p.category || undefined,
    brand: {
      "@type": "Brand",
      name: "FAW",
    },
    ...(hasPrice ? {
      offers: {
        "@type": "Offer",
        priceCurrency: "MAD",
        price: p.price,
        itemCondition: "https://schema.org/NewCondition",
        availability: p.available !== false ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        seller: {
          "@type": "Organization",
          name: SITE.name,
        },
        url: `${SITE.url}/produits/${p.slug}`,
      },
    } : {}),
  };
}

/** Article JSON-LD schema for blog / content posts. */
export function articleLd(article: {
  title: string;
  description?: string;
  slug: string;
  image?: string;
  publishedAt?: string;
  updatedAt?: string;
  authorName?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description || undefined,
    url: `${SITE.url}/blog/${article.slug}`,
    image: article.image ? (article.image.startsWith("http") ? article.image : `${SITE.url}${article.image}`) : undefined,
    datePublished: article.publishedAt || undefined,
    dateModified: article.updatedAt || undefined,
    author: {
      "@type": "Organization",
      name: article.authorName || SITE.name,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      logo: {
        "@type": "ImageObject",
        url: `${SITE.url}/icon.png`,
      },
    },
  };
}

/** JSON-LD sûr dans un <script> (échappe « < »). */
export function ldJson(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
