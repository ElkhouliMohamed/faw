import "server-only";
import { cache } from "react";
import { z } from "zod";
import { publicJson } from "./shop-api";
import { SITE, socialLinks } from "./site";

// Contenu global édité dans Filament : coordonnées (Réseaux sociaux & coordonnées), thème, menus (Menus du site),
// sections de l'accueil (Accueil). Laravel valide chaque valeur ; une valeur absente garde le réglage par défaut du site.

const str = z.string().nullable().optional().transform((v) => (v && v.trim() ? v.trim() : null));
const LINK = /^(?:\/(?!\/)[^\s<>\\]*|https:\/\/[^\s<>\\]+|tel:\+?[0-9 ]{6,20}|mailto:[^\s<>\\@]+@[^\s<>\\@]+)$/;
const IMAGE = /^\/(?:images|storage)\/[a-zA-Z0-9_./-]+\.(?:png|jpe?g|webp|gif|avif)$/i;
const link = z.string().regex(LINK);
const optLink = z.string().optional().transform((v) => (v && LINK.test(v) ? v : ""));
const optImage = z.string().optional().transform((v) => (v && IMAGE.test(v) ? v : ""));
const text = z.string().optional().transform((v) => v ?? "");

const menuSchema = z
  .object({ title: z.string(), items: z.array(z.object({ label: z.string().min(1), url: link, newTab: z.boolean(), highlight: z.boolean() })) })
  .nullable();
export type MenuItem = { label: string; url: string; newTab?: boolean; highlight?: boolean };
export type Menu = { title: string; items: MenuItem[] };

const siteSchema = z.object({
  contact: z.object({ phone: str, whatsappNumber: str, email: str, address: str, depotAddress: str, hours: str, mapsUrl: str, wazeUrl: str }),
  socials: z.object({ instagram: str, linkedin: str, facebook: str }),
  theme: z.object({ primaryColor: str, logo: str, logoDark: str }),
  menus: z.object({ header: menuSchema, footer_shop: menuSchema, footer_info: menuSchema, footer_legal: menuSchema }),
});

export type Contact = {
  phone: string;
  phoneHref: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  email: string;
  address: string;
  depotAddress: string;
  hours: string;
  mapsUrl: string;
  wazeUrl: string;
};
export type SiteContent = {
  contact: Contact;
  socials: { key: "instagram" | "linkedin" | "facebook"; url: string }[];
  theme: { primaryColor: string | null; logo: string | null; logoDark: string | null };
  menus: { header: Menu | null; footerShop: Menu | null; footerInfo: Menu | null; footerLegal: Menu | null };
};

/** « 212660121813 » -> « +212 660 121 813 » (affichage), lien wa.me sans espaces. */
export function formatMoroccanNumber(digits: string) {
  const m = digits.match(/^212(\d)(\d{2})(\d{3})(\d{3})$/);
  return m ? `+212 ${m[1]}${m[2]} ${m[3]} ${m[4]}` : `+${digits}`;
}
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

const DEFAULT_CONTACT: Contact = {
  phone: SITE.phone,
  phoneHref: SITE.phoneHref,
  whatsappNumber: SITE.whatsappNumber,
  whatsappDisplay: SITE.whatsappDisplay,
  email: SITE.email,
  address: SITE.address,
  depotAddress: SITE.depotAddress,
  hours: SITE.hours,
  mapsUrl: SITE.mapsUrl,
  wazeUrl: SITE.wazeUrl,
};

/** Contenu global du site (un appel par rendu, cache Next "site" vidé par Filament). Jamais d'erreur : valeurs par défaut. */
export const siteContent = cache(async function siteContent(): Promise<SiteContent> {
  const parsed = siteSchema.safeParse(await publicJson("/api/site", "site", 4000));
  const d = parsed.success ? parsed.data : null;
  const c = d?.contact;
  const contact: Contact = {
    ...DEFAULT_CONTACT,
    ...(c?.phone ? { phone: c.phone, phoneHref: telHref(c.phone) } : {}),
    ...(c?.whatsappNumber ? { whatsappNumber: c.whatsappNumber, whatsappDisplay: formatMoroccanNumber(c.whatsappNumber) } : {}),
    ...(c?.email ? { email: c.email } : {}),
    ...(c?.address ? { address: c.address } : {}),
    ...(c?.depotAddress ? { depotAddress: c.depotAddress } : {}),
    ...(c?.hours ? { hours: c.hours } : {}),
    ...(c?.mapsUrl ? { mapsUrl: c.mapsUrl } : {}),
    ...(c?.wazeUrl ? { wazeUrl: c.wazeUrl } : {}),
  };
  // Repli : NEXT_PUBLIC_INSTAGRAM_URL / NEXT_PUBLIC_LINKEDIN_URL (comportement précédent), jamais d'URL devinée.
  const envSocials = socialLinks();
  const socials = (["instagram", "linkedin", "facebook"] as const).flatMap((key) => {
    const url = d?.socials[key] ?? envSocials.find((s) => s.key === key)?.url ?? null;
    return url ? [{ key, url }] : [];
  });
  return {
    contact,
    socials,
    theme: { primaryColor: d?.theme.primaryColor ?? null, logo: d?.theme.logo ?? null, logoDark: d?.theme.logoDark ?? null },
    menus: {
      header: d?.menus.header ?? null,
      footerShop: d?.menus.footer_shop ?? null,
      footerInfo: d?.menus.footer_info ?? null,
      footerLegal: d?.menus.footer_legal ?? null,
    },
  };
});

export function waHref(contact: Pick<Contact, "whatsappNumber">, message?: string) {
  const base = `https://wa.me/${contact.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/* ------------------------------ Accueil ------------------------------ */

const sectionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("hero"), eyebrow: text, title: z.string().min(1), subtitle: text, image: optImage, imageAlt: text,
    primaryLabel: text, primaryUrl: optLink, secondaryLabel: text, secondaryUrl: optLink, showContact: z.boolean().optional().default(true),
  }),
  z.object({ type: z.literal("categories"), title: text, subtitle: text, slugs: z.array(z.string()).optional().default([]) }),
  z.object({ type: z.literal("products"), title: text, subtitle: text, ids: z.array(z.string()).optional().default([]), linkLabel: text, linkUrl: optLink }),
  z.object({ type: z.literal("usps"), title: text, subtitle: text, items: z.array(z.object({ icon: text, title: z.string(), text: text })).optional().default([]) }),
  z.object({ type: z.literal("references"), title: text, subtitle: text, logos: z.array(z.object({ name: z.string(), image: optImage, url: optLink })).optional().default([]) }),
  z.object({ type: z.literal("testimonials"), title: text, subtitle: text, items: z.array(z.object({ quote: z.string(), author: z.string(), role: text })).optional().default([]) }),
  z.object({ type: z.literal("cta"), title: z.string(), text: text, label: z.string(), url: optLink, showWhatsapp: z.boolean().optional().default(true) }),
  z.object({ type: z.literal("blog"), title: text, count: z.number().int().min(1).max(6).optional().default(3) }),
  z.object({ type: z.literal("text"), title: text, body: z.string() }),
  z.object({ type: z.literal("faq"), title: text, items: z.array(z.object({ q: z.string(), a: z.string() })).optional().default([]) }),
]);
export type HomeSection = z.infer<typeof sectionSchema>;
export type HomeSectionOf<T extends HomeSection["type"]> = Extract<HomeSection, { type: T }>;

const homeSchema = z.object({
  home: z
    .object({
      title: z.string(),
      excerpt: str,
      image: str,
      ctaLabel: str,
      ctaUrl: str,
      seoTitle: str,
      seoDescription: str,
      legacy: z.boolean(),
      defaultSections: z.boolean(),
      sections: z.array(z.unknown()),
      updatedAt: str,
    })
    .nullable(),
});
export type HomeContent = Omit<NonNullable<z.infer<typeof homeSchema>["home"]>, "sections"> & { sections: HomeSection[] };

/** Accueil publié dans Filament, ou null (accueil par défaut). Une section invalide est ignorée, pas toute la page. */
export const homeContent = cache(async function homeContent(): Promise<HomeContent | null> {
  const parsed = homeSchema.safeParse(await publicJson("/api/home", "home", 4000));
  const home = parsed.success ? parsed.data.home : null;
  if (!home) return null;
  const sections = home.sections.flatMap((s) => {
    const v = sectionSchema.safeParse(s);
    return v.success ? [v.data] : [];
  });
  return { ...home, sections };
});
