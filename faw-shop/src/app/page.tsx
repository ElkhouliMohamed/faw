import Link from "next/link";
import { Hero } from "@/components/hero";
import { Intro, introScript } from "@/components/intro";
import { getDict } from "@/lib/i18n-server";
import { CATEGORIES, categoryHref } from "@/lib/products";
import { alternates, nonce } from "@/lib/seo";
import type { Metadata } from "next";

// Next (resolve-url) réduit toute URL de chemin « / » à l'origine et perd « ?lang=ar » :
// les liens canonical/hreflang de l'accueil sont donc rendus ici (React les remonte dans <head>).
export const metadata: Metadata = {};

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

export default async function Home() {
  const { t, locale } = await getDict();
  const families = CATEGORIES.filter((c) => c.key !== "portes-coupe-feu").map((c) => ({
    key: c.key,
    image: c.image,
    href: categoryHref(c.key),
    count: 0,
    min: 0,
  }));
  const n = await nonce();
  return (
    <>
      <HomeLinks />
      {/* intro : décidée avant le 1er rendu, calque fixe au-dessus du hero déjà rendu */}
      <script nonce={n} dangerouslySetInnerHTML={{ __html: introScript }} />
      <Intro />
      <Hero t={t} locale={locale} categories={families} />

      <section className="shell pb-16 lg:pb-20" aria-label={t.home.whyTitle}>
        <ul className="hairline grid gap-4 pt-8 text-[1.0625rem] leading-relaxed text-foreground sm:grid-cols-3 sm:gap-6">
          {t.home.reassure.map((item) => (
            <li key={item} className="font-medium">
              {item}
            </li>
          ))}
        </ul>
        <p className="mt-8">
          <Link href="/devis" className="btn btn-cta h-14 min-h-14 px-6 text-[1.125rem]" data-testid="home-quote">
            {t.home.ctaQuote}
          </Link>
        </p>
      </section>
    </>
  );
}
