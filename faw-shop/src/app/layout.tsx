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
import { isLive, merch, shopConfig } from "@/lib/merch";
import { stripPriceMentions } from "@/lib/format";
import { Popups, type PublicPopup } from "@/components/popups";
import { toPublic } from "@/lib/products";
import { issueFormToken } from "@/lib/security";
import { ldJson, nonce, organizationLd } from "@/lib/seo";
import { categoryTree } from "@/lib/category-tree";
import { blogPosts } from "@/lib/content";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getDict();
  const config=await publicConfig();
  const rawPixel = config?.integrations.pixelId || runtimeEnv("NEXT_PUBLIC_META_PIXEL_ID") || runtimeEnv("META_PIXEL_ID");
  const pixelId = (config?.integrations.pixelEnabled ?? true) && rawPixel && /^\d{5,20}$/.test(rawPixel) ? rawPixel : undefined;
  const rawGa = config?.integrations.gaId || runtimeEnv("NEXT_PUBLIC_GA_ID");
  const gaId = (config?.integrations.gaEnabled ?? true) && rawGa && /^G-[A-Z0-9]{4,20}$/.test(rawGa) ? rawGa : undefined;
  const products = await allProducts();
  const showPrices = config?.shop?.showPrices === true;
  const catalog = products.map((p) => toPublic(p, showPrices));
  const shop = await shopConfig(products, showPrices);
  const [tree, posts] = await Promise.all([categoryTree(), blogPosts(undefined, undefined, 1).catch(() => ({ data: [] as unknown[] }))]);
  const footerCats = tree.filter((c) => c.parentId == null).map((c) => ({ path: c.path, label: c.label }));
  const popups: PublicPopup[] = (await merch()).popups.filter((p) => isLive(p)).map((p) => ({
    id: p.id, v: String(p.updatedAt.getTime()), kind: (["promo", "newsletter", "whatsapp"].includes(p.kind) ? p.kind : "promo") as PublicPopup["kind"],
    title: p.title, body: p.body, ctaLabel: p.ctaLabel, ctaUrl: /^(\/(?!\/)|https:\/\/)/.test(p.ctaUrl) ? p.ctaUrl : "",
    trigger: (["delay", "scroll", "exit"].includes(p.trigger) ? p.trigger : "delay") as PublicPopup["trigger"],
    delaySeconds: p.delaySeconds, scrollPercent: p.scrollPercent, paths: p.paths.split(",").map((x) => x.trim()).filter((x) => x.startsWith("/")),
    frequency: (["once", "session", "days"].includes(p.frequency) ? p.frequency : "session") as PublicPopup["frequency"], frequencyDays: p.frequencyDays,
  }));
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning data-faw-accent={config?.theme.accent || "copper"} className={`${vietnam.variable} ${arabic.variable} ${config?.theme.mode === "dark" ? "dark" : ""}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <a href="#contenu" className="sr-only z-[60] rounded-lg bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
          Aller au contenu
        </a>
        <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(organizationLd(config?.shop?.showPrices === true))} />
        <Providers defaultTheme={config?.theme.mode || "light"} locale={locale} catalog={catalog} shop={shop} formToken={issueFormToken()} nonce={await nonce()}>
          <AttributionCapture />
          <PageTracker />
          <ConsentedTracking gaId={gaId} pixelId={pixelId} adsId={config?.integrations.adsEnabled ? config.integrations.adsId || undefined:undefined} adsLabel={config?.integrations.adsLabel || undefined} />
          <Header />
          <main id="contenu">{children}</main>
          <Footer t={t} socialConfig={config?.social} categories={footerCats} hasBlog={posts.data.length > 0} />
          <FloatingWhatsApp config={config?.social} />
          <SiteBot />
          <ConsentBanner />
          <Popups popups={popups} />
        </Providers>
      </body>
    </html>
  );
}
