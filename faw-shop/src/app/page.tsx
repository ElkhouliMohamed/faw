import type { Metadata } from "next";
import { Intro, introScript } from "@/components/intro";
import { Blocks } from "@/components/blocks";
import { BlogSection, CategoriesSection, HeroSection, ReferencesSection, TestimonialsSection, UspsSection, type CategoryTile } from "@/components/home/sections";
import { HeroSlider } from "@/components/home/hero-slider";
import { FeaturesSection } from "@/components/home/features";
import { ProductsShowcase } from "@/components/home/products-showcase";
import { SectorsSection } from "@/components/home/sectors";
import { AboutSection } from "@/components/home/about";
import { HighlightsSection } from "@/components/home/highlights";
import { ProjectsSection } from "@/components/home/projects";
import { ProcessSection } from "@/components/home/process";
import { ContactCtaSection } from "@/components/home/contact-cta";
import { getDict } from "@/lib/i18n-server";
import type { Dict } from "@/lib/i18n";
import { CATEGORIES, categoryHref, categoryKey, toPublic } from "@/lib/products";
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
    {
      type: "cta", title: t.home.b2bTitle, text: t.home.b2bText, label: t.home.ctaQuote, url: "/devis", showWhatsapp: true,
      showPhone: true, phone: "", phoneLabel: "", whatsappNumber: "", whatsappLabel: "", backgroundImage: "",
    },
  ];
}

/**
 * Sections à afficher. Sans accueil publié, Laravel renvoie le modèle du client (template) ; API injoignable : accueil minimal.
 * Accueil publié : ses sections, précédées de la bannière par défaut (titre / sous-titre / bouton
 * de l'enregistrement) s'il n'en a pas. Ancien format (avant le constructeur de sections) : sections par défaut conservées.
 */
function resolveSections(home: HomeContent | null, t: Dict): { sections: HomeSection[]; isDefault: boolean } {
  const defaults = defaultSections(t);
  if (!home) return { sections: defaults, isDefault: true };
  const sections = [...home.sections];
  if (!sections.some((s) => s.type === "hero" || s.type === "heroSlider")) {
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
  const need = new Set<string>(sections.map((s) => s.type));
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

  /** Produits du catalogue d'une section : choisis un par un, sinon les premiers d'une catégorie. */
  const sectionProducts = (s: HomeSectionOf<"products">) => {
    const byId = new Map(products.map((p) => [p.id, p]));
    const picked = s.ids.length
      ? s.ids.map((id) => byId.get(id)).filter((p) => !!p)
      : s.category
        ? products.filter((p) => p.active && (p.catSlug === s.category || categoryKey(p) === s.category)).slice(0, s.count)
        : [];
    return picked.map((p) => toPublic(p, showPrices));
  };
  const photoSoon = t.layout.photoSoon;
  const waMessage = locale === "ar" ? "السلام عليكم، أريد عرض سعر." : "Bonjour FAW, je souhaite un devis.";

  let firstHero = true;
  return (
    <div data-home className="bg-paper pb-16 lg:pb-20">
      <HomeLinks />
      {/* intro : décidée avant le 1er rendu, calque fixe au-dessus du hero déjà rendu */}
      <script nonce={n} dangerouslySetInnerHTML={{ __html: introScript }} />
      <Intro />
      {sections.map((s, i) => {
        switch (s.type) {
          case "heroSlider": {
            const h1 = firstHero;
            firstHero = false;
            return (
              <HeroSlider
                key={i}
                slides={s.slides}
                autoplay={s.autoplay}
                interval={s.interval}
                whatsappHref={contact.whatsappHref}
                h1={h1}
                labels={{ region: t.layout.slider, slide: t.layout.slide, of: t.layout.of, pause: t.layout.pause, play: t.layout.play, goTo: t.layout.goTo, photoSoon }}
              />
            );
          }
          case "features":
            return <FeaturesSection key={i} s={s} index={i} overlap={i > 0 && (sections[i - 1].type === "heroSlider" || sections[i - 1].type === "hero")} />;
          case "sectors":
            return <SectorsSection key={i} s={s} index={i} />;
          case "about":
            return <AboutSection key={i} s={s} index={i} photoSoon={photoSoon} />;
          case "highlights":
            return <HighlightsSection key={i} s={s} index={i} />;
          case "projects":
            return <ProjectsSection key={i} s={s} index={i} />;
          case "process":
            return <ProcessSection key={i} s={s} index={i} />;
          case "hero": {
            const h1 = firstHero;
            firstHero = false;
            return <HeroSection key={i} s={s} contact={contact} labels={{ call: t.home.ctaCall, message: t.home.ctaMessage }} caption={isDefault && i === 0 ? t.home.imageCaption : undefined} h1={h1} />;
          }
          case "categories":
            return <CategoriesSection key={i} s={s} items={categoryTiles(s)} index={i} />;
          case "products":
            return <ProductsShowcase key={i} s={s} products={sectionProducts(s)} catLabel={(p) => t.cats[p.cat]} index={i} photoSoon={photoSoon} />;
          case "usps":
            return <UspsSection key={i} s={s} index={i} />;
          case "references":
            return <ReferencesSection key={i} s={s} index={i} />;
          case "testimonials":
            return <TestimonialsSection key={i} s={s} index={i} />;
          case "cta":
            return <ContactCtaSection key={i} s={s} contact={contact} waMessage={waMessage} index={i} />;
          case "blog":
            return <BlogSection key={i} s={s} posts={posts.data} readLabel={locale === "ar" ? "اقرأ" : "Lire l’article"} allLabel={locale === "ar" ? "كل المقالات" : "Tous les articles"} index={i} />;
          case "text":
            return <Blocks key={i} blocks={[{ type: "text", title: s.title || undefined, body: s.body }]} products={[]} hasH1 showPrices={showPrices} />;
          case "faq":
            return s.items.length ? <Blocks key={i} blocks={[{ type: "faq", title: s.title || undefined, items: s.items }]} products={[]} hasH1 showPrices={showPrices} /> : null;
        }
      })}
    </div>
  );
}
