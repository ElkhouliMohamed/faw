import type { Metadata } from "next";
import { Intro, introScript } from "@/components/intro";
import { Blocks } from "@/components/blocks";
import {
  BlogSection,
  CategoriesSection,
  CtaSection,
  HeroSection,
  ProductsSection,
  ReferencesSection,
  TestimonialsSection,
  UspsSection,
  type CategoryTile,
} from "@/components/home/sections";
import { getDict } from "@/lib/i18n-server";
import type { Dict } from "@/lib/i18n";
import { CATEGORIES, categoryHref, toPublic } from "@/lib/products";
import { alternates, nonce } from "@/lib/seo";
import { homeContent, siteContent, waHref, type HomeContent, type HomeSection, type HomeSectionOf } from "@/lib/site-content";
import { allProducts } from "@/lib/catalog";
import { categoryTree } from "@/lib/category-tree";
import { blogPosts } from "@/lib/content";
import { showPublicPrices } from "@/lib/price-visibility";
import { stripPriceMentions } from "@/lib/format";

// Next (resolve-url) réduit toute URL de chemin « / » à l'origine et perd « ?lang=ar » :
// les liens canonical/hreflang de l'accueil sont donc rendus ici (React les remonte dans <head>).
export async function generateMetadata(): Promise<Metadata> {
  const home = await homeContent();
  const showPrices = await showPublicPrices();
  const clean = (s: string) => (showPrices ? s : stripPriceMentions(s));
  return {
    ...(home?.seoTitle ? { title: { absolute: clean(home.seoTitle) } } : {}),
    ...(home?.seoDescription ? { description: clean(home.seoDescription) } : {}),
  };
}

async function HomeLinks() {
  const a = await alternates("/");
  return (
    <>
      <link rel="canonical" href={a.canonical} />
      {Object.entries(a.languages).map(([lang, href]) => (
        <link key={lang} rel="alternate" hrefLang={lang} href={href} />
      ))}
    </>
  );
}

const HERO_IMAGE = "/images/products/v7-2/CF-EI60-100-photo.jpg";
const DEFAULT_FAMILIES = ["galandage", "incendie", "automatisme"];

/** Accueil par défaut (aucun accueil publié dans Filament), dans la langue du visiteur. */
function defaultSections(t: Dict): HomeSection[] {
  return [
    {
      type: "hero", eyebrow: t.home.focusEyebrow, title: t.home.heroTitle, subtitle: t.home.heroLead, image: HERO_IMAGE,
      imageAlt: "Porte coupe-feu un vantail FAW, photo sur fond clair", primaryLabel: t.home.ctaQuote, primaryUrl: "/devis",
      secondaryLabel: t.home.ctaFireDoors, secondaryUrl: "/produits/portes-coupe-feu", showContact: true,
    },
    { type: "categories", title: t.home.familiesTitle, subtitle: "", slugs: [] },
    { type: "usps", title: t.home.whyTitle, subtitle: "", items: t.home.reassure.map((title, i) => ({ icon: ["file", "warehouse", "badge"][i] ?? "badge", title, text: "" })) },
    { type: "cta", title: t.home.b2bTitle, text: t.home.b2bText, label: t.home.ctaQuote, url: "/devis", showWhatsapp: true },
  ];
}

/**
 * Sections à afficher. Accueil publié : ses sections, précédées de la bannière par défaut (titre / sous-titre / bouton
 * de l'enregistrement) s'il n'en a pas. Ancien format (avant le constructeur de sections) : sections par défaut conservées.
 */
function resolveSections(home: HomeContent | null, t: Dict): { sections: HomeSection[]; isDefault: boolean } {
  const defaults = defaultSections(t);
  if (!home) return { sections: defaults, isDefault: true };
  const sections = [...home.sections];
  if (!sections.some((s) => s.type === "hero")) {
    const base = defaults[0] as HomeSectionOf<"hero">;
    const hero: HomeSectionOf<"hero"> = {
      ...base,
      title: home.title || base.title,
      subtitle: home.excerpt ?? base.subtitle,
      image: home.image ?? base.image,
      ...(home.ctaLabel && home.ctaUrl ? { primaryLabel: home.ctaLabel, primaryUrl: home.ctaUrl } : {}),
    };
    sections.unshift(hero);
  }
  if (home.legacy && home.defaultSections) sections.splice(1, 0, ...defaults.slice(1));
  return { sections, isDefault: false };
}

export default async function Home() {
  const [{ t, locale }, home, site, n] = await Promise.all([getDict(), homeContent(), siteContent(), nonce()]);
  const { sections, isDefault } = resolveSections(home, t);
  const need = new Set(sections.map((s) => s.type));
  const [showPrices, products, tree, posts] = await Promise.all([
    showPublicPrices(),
    need.has("products") ? allProducts().catch(() => []) : Promise.resolve([]),
    need.has("categories") ? categoryTree().catch(() => []) : Promise.resolve([]),
    need.has("blog") ? blogPosts(undefined, undefined, 1) : Promise.resolve({ data: [] }),
  ]);
  const contact = { ...site.contact, whatsappHref: waHref(site.contact, locale === "ar" ? "السلام عليكم، أريد عرض سعر." : "Bonjour FAW, je souhaite un devis.") };
  const familyLabel = (key: string) => (t.home.familyLabels as Record<string, string>)[key] || t.cats[key as keyof typeof t.cats] || key;

  const categoryTiles = (s: HomeSectionOf<"categories">): CategoryTile[] => {
    const staticImage = (family: string) => CATEGORIES.find((c) => c.key === family)?.image ?? null;
    if (!s.slugs.length && (isDefault || !tree.length)) {
      // Familles historiques (hors portes coupe-feu, déjà en bannière), libellés traduits.
      return CATEGORIES.filter((c) => DEFAULT_FAMILIES.includes(c.key)).map((c) => ({ key: c.key, label: familyLabel(c.key), href: categoryHref(c.key), image: c.image }));
    }
    const nodes = s.slugs.length ? s.slugs.map((slug) => tree.find((c) => c.slug === slug)).filter((c) => !!c) : tree.filter((c) => c.parentId == null);
    return nodes.map((c) => ({ key: c.slug, label: c.label, href: c.path, image: c.image ?? staticImage(c.family) }));
  };

  let firstHero = true;
  return (
    <>
      <HomeLinks />
      {/* intro : décidée avant le 1er rendu, calque fixe au-dessus du hero déjà rendu */}
      <script nonce={n} dangerouslySetInnerHTML={{ __html: introScript }} />
      <Intro />
      {sections.map((s, i) => {
        switch (s.type) {
          case "hero": {
            const h1 = firstHero;
            firstHero = false;
            return <HeroSection key={i} s={s} contact={contact} labels={{ call: t.home.ctaCall, message: t.home.ctaMessage }} caption={isDefault && i === 0 ? t.home.imageCaption : undefined} h1={h1} />;
          }
          case "categories":
            return <CategoriesSection key={i} s={s} items={categoryTiles(s)} index={i} />;
          case "products": {
            const byId = new Map(products.map((p) => [p.id, p]));
            const list = s.ids.map((id) => byId.get(id)).filter((p) => !!p).map((p) => toPublic(p, showPrices));
            return <ProductsSection key={i} s={s} products={list} catLabel={(p) => t.cats[p.cat]} noImage={t.product.noImage} index={i} />;
          }
          case "usps":
            return <UspsSection key={i} s={s} index={i} />;
          case "references":
            return <ReferencesSection key={i} s={s} index={i} />;
          case "testimonials":
            return <TestimonialsSection key={i} s={s} index={i} />;
          case "cta":
            return <CtaSection key={i} s={s} whatsappHref={contact.whatsappHref} whatsappLabel={t.home.ctaWa} index={i} />;
          case "blog":
            return <BlogSection key={i} s={s} posts={posts.data} readLabel={locale === "ar" ? "اقرأ" : "Lire l’article"} allLabel={locale === "ar" ? "كل المقالات" : "Tous les articles"} index={i} />;
          case "text":
            return <Blocks key={i} blocks={[{ type: "text", title: s.title || undefined, body: s.body }]} products={[]} hasH1 showPrices={showPrices} />;
          case "faq":
            return s.items.length ? <Blocks key={i} blocks={[{ type: "faq", title: s.title || undefined, items: s.items }]} products={[]} hasH1 showPrices={showPrices} /> : null;
        }
      })}
    </>
  );
}
