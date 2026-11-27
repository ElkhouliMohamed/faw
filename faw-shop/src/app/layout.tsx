import {publicConfig} from "@/lib/public-config";
import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { AttributionCapture, PageTracker } from "@/components/tracking";
import { ConsentBanner, ConsentedTracking } from "@/components/consent";
import { FloatingWhatsApp } from "@/components/floating-wa";
import { SiteBot } from "@/components/site-bot";
import { getDict } from "@/lib/i18n-server";
import { SITE, runtimeEnv } from "@/lib/site";
import { allProducts } from "@/lib/catalog";
import { merch, shopConfig } from "@/lib/merch";
import { stripPriceMentions } from "@/lib/format";
import { Popups, type PublicPopup } from "@/components/popups";
import { toPublic } from "@/lib/products";
import { issueFormToken } from "@/lib/security";
import { ldJson, nonce, organizationLd } from "@/lib/seo";
import { categoryTree } from "@/lib/category-tree";
import { blogPosts } from "@/lib/content";
import { siteContent, waHref } from "@/lib/site-content";

const vietnam = Be_Vietnam_Pro({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-vietnam", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "600", "700"], variable: "--font-arabic", display: "swap", preload: false });

export async function generateMetadata(): Promise<Metadata> {
  // Lu au runtime (pas inliné au build) : activable sans rebuild.
  const config=await publicConfig();
  const noindex = config?.seo.noindex ?? (runtimeEnv("NEXT_PUBLIC_NOINDEX") === "1");
  const gsc = config?.integrations.gscVerification || runtimeEnv("NEXT_PUBLIC_GSC_VERIFICATION");
  return {
  metadataBase: new URL(config?.seo.canonicalBase || SITE.url),
  title: { default: "FAW Aluminium – Boutique : portes coupe-feu EI60, galandage, incendie | Casablanca", template: config?.seo.titleTemplate || "%s | FAW Aluminium" },
  description: (config?.shop?.showPrices === true
      ? (config?.seo.description || "Boutique FAW Aluminium à Casablanca : portes coupe-feu EI60, portes coulissantes à galandage, extincteurs et matériel incendie, kit moteur portail. Prix en DH TTC, retrait gratuit au dépôt.")
      : stripPriceMentions(config?.seo.description || "Boutique FAW Aluminium à Casablanca : portes coupe-feu EI60, portes coulissantes à galandage, extincteurs et matériel incendie, kit moteur portail. Prix sur devis, retrait gratuit au dépôt.")),
  applicationName: "FAW Aluminium",
  openGraph: {
    type: "website",
    locale: "fr_MA",
    siteName: "FAW Aluminium",
    images: [{ url: config?.seo.ogImage || "/og.jpg", width: 1200, height: 630, alt: "FAW Aluminium – boutique en ligne, Casablanca" }],
  },
  twitter: { card: "summary_large_image" },
  robots: noindex ? { index: false, follow: false } : { index: true, follow: true, "max-image-preview": "large" },
  ...(gsc && /^[\w-]{10,100}$/.test(gsc) ? { verification: { google: gsc } } : {}),
  formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1c120a" },
  ],
};

/** Couleur des boutons choisie dans Filament (Thèmes) : remplace l'accent, texte clair ou foncé selon le contraste. */
function brandColorStyle(hex: string | null): React.CSSProperties | undefined {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return undefined;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // contraste avec le blanc vs avec le brun profond (#2b1a0b, luminance ≈ 0.012)
  const fg = (1.05 / (luminance + 0.05)) >= ((luminance + 0.05) / 0.062) ? "#ffffff" : "#2b1a0b";
  return { "--primary": hex, "--flame": hex, "--sidebar-primary": hex, "--primary-foreground": fg, "--sidebar-primary-foreground": fg } as React.CSSProperties;
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Tous les appels en parallèle ; chacun est dédupliqué par React cache() et servi par le cache de données Next.
  const [{ locale, t }, config, site, products, m, tree, posts, n] = await Promise.all([
    getDict(),
    publicConfig(),
    siteContent(),
    allProducts(),
    merch(),
    categoryTree(),
    blogPosts(undefined, undefined, 1),
    nonce(),
  ]);
  const rawPixel = config?.integrations.pixelId || runtimeEnv("NEXT_PUBLIC_META_PIXEL_ID") || runtimeEnv("META_PIXEL_ID");
  const pixelId = (config?.integrations.pixelEnabled ?? true) && rawPixel && /^\d{5,20}$/.test(rawPixel) ? rawPixel : undefined;
  const rawGa = config?.integrations.gaId || runtimeEnv("NEXT_PUBLIC_GA_ID");
  const gaId = (config?.integrations.gaEnabled ?? true) && rawGa && /^G-[A-Z0-9]{4,20}$/.test(rawGa) ? rawGa : undefined;
  const showPrices = config?.shop?.showPrices === true;
  const catalog = products.map((p) => toPublic(p, showPrices));
  const shop = await shopConfig(products, showPrices);
  const footerCats = tree.filter((c) => c.parentId == null).map((c) => ({ path: c.path, label: c.label }));
  // Popups actifs et en cours (filtrés et nettoyés par Laravel).
  const popups: PublicPopup[] = m.popups;
  const { contact } = site;
  const headerLinks = site.menus.header?.items ?? [
    { label: t.nav.shop, url: "/produits" },
    { label: t.nav.delivery, url: "/livraison" },
    { label: t.nav.contact, url: "/contact" },
  ];
  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      suppressHydrationWarning
      data-faw-accent={config?.theme.accent || "copper"}
      className={`${vietnam.variable} ${arabic.variable} ${config?.theme.mode === "dark" ? "dark" : ""}`}
      style={brandColorStyle(site.theme.primaryColor)}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a href="#contenu" className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
          Aller au contenu
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(organizationLd(config?.shop?.showPrices === true))} />
        <Providers defaultTheme={config?.theme.mode || "light"} locale={locale} catalog={catalog} shop={shop} formToken={issueFormToken()} nonce={n}>
          <AttributionCapture />
          <PageTracker />
          <ConsentedTracking gaId={gaId} pixelId={pixelId} adsId={config?.integrations.adsEnabled ? config.integrations.adsId || undefined:undefined} adsLabel={config?.integrations.adsLabel || undefined} />
          <Header
            links={headerLinks}
            contact={{ phone: contact.phone, phoneHref: contact.phoneHref, whatsappHref: waHref(contact), whatsappDisplay: contact.whatsappDisplay, email: contact.email, hours: contact.hours }}
            logo={site.theme.logo}
            logoDark={site.theme.logoDark}
          />
          <main id="contenu">{children}</main>
          <Footer t={t} contact={contact} socials={site.socials} menus={site.menus} categories={footerCats} hasBlog={posts.data.length > 0} logoDark={site.theme.logoDark} />
          <FloatingWhatsApp config={config?.social} />
          <SiteBot />
          <ConsentBanner />
          <Popups popups={popups} />
        </Providers>
      </body>
    </html>
  );
}
