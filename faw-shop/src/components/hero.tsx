import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, Phone } from "lucide-react";
import { WhatsAppIcon } from "./icons";
import type { Dict, Locale } from "@/lib/i18n";
import type { CategoryKey } from "@/lib/products";
import { SITE, waLink } from "@/lib/site";

export type HeroCategory = { key: CategoryKey; image: string; href: string; count: number; min: number };

const HERO_IMAGE = "/images/products/v7-2/CF-EI60-100-photo.jpg";
const HERO_ALT = "Porte coupe-feu un vantail FAW, photo sur fond clair";
const FIRE_DOORS_HREF = "/produits/portes-coupe-feu";

/**
 * Accueil v7 : une seule famille en vedette (portes coupe-feu), une image de taille raisonnable,
 * un bouton principal « Demander un devis », un appel téléphone / message, puis les autres familles
 * en boutons compacts. Texte large, contrasté, cibles tactiles ≥ 48 px.
 */
export function Hero({
  t,
  locale,
  categories,
}: {
  t: Dict;
  locale: Locale;
  product?: unknown;
  categories: HeroCategory[];
  showPrices?: boolean;
  copy?: unknown;
}) {
  const ar = locale === "ar";
  const waText = ar
    ? "السلام عليكم، أريد عرض سعر لباب مقاوم للحريق."
    : "Bonjour FAW, je souhaite un devis pour une porte coupe-feu.";
  const familyLabel = (key: CategoryKey) =>
    (key !== "portes-coupe-feu" && t.home.familyLabels[key]) || t.cats[key];

  return (
    <>
      <section className="shell pt-8 pb-10 sm:pt-12 lg:pt-16 lg:pb-14" aria-labelledby="hero-title">
        <div className="grid-12 items-center gap-y-10">
          <div className="col-span-12 lg:col-span-6 lg:pe-6 xl:pe-10">
            <p className="eyebrow text-copper">{t.home.focusEyebrow}</p>
            <h1 id="hero-title" className="mt-4 max-w-[16ch] text-d1 font-semibold text-balance">
              {t.home.heroTitle}
            </h1>
            <p className="mt-5 max-w-[42ch] text-[1.125rem] leading-relaxed text-foreground sm:text-lead">
              {t.home.heroLead}
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/devis"
                className="btn btn-cta h-14 min-h-14 w-full px-6 text-[1.125rem] sm:w-auto"
                data-testid="hero-quote"
              >
                <FileText className="size-5 shrink-0" aria-hidden />
                {t.home.ctaQuote}
              </Link>

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={SITE.phoneHref}
                  className="btn btn-ghost h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 sm:w-auto"
                  data-testid="hero-call"
                >
                  <Phone className="size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-start">
                    <span className="text-[1.0625rem] font-semibold leading-tight">{t.home.ctaCall}</span>
                    <span dir="ltr" className="text-[1.0625rem] font-medium leading-tight tnum">
                      {SITE.phone}
                    </span>
                  </span>
                </a>
                <a
                  href={waLink(waText)}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-ghost h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 sm:w-auto"
                  data-testid="hero-message"
                >
                  <WhatsAppIcon className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-start">
                    <span className="text-[1.0625rem] font-semibold leading-tight">{t.home.ctaMessage}</span>
                    <span dir="ltr" className="text-[1.0625rem] font-medium leading-tight tnum">
                      {SITE.whatsappDisplay}
                    </span>
                  </span>
                </a>
              </div>

              <Link
                href={FIRE_DOORS_HREF}
                className="group inline-flex min-h-12 items-center gap-2 self-start pt-1 text-[1.0625rem] font-semibold underline decoration-rule underline-offset-4 hover:text-copper hover:decoration-copper"
                data-testid="hero-shop"
              >
                {t.home.ctaFireDoors}
                <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <Link
              href={FIRE_DOORS_HREF}
              className="relative mx-auto block w-full max-w-[20rem] lg:ms-0 lg:max-w-[22rem]"
              aria-label={t.home.ctaFireDoors}
            >
              <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-[#f5f1eb]">
                <Image
                  src={HERO_IMAGE}
                  alt={HERO_ALT}
                  fill
                  priority
                  sizes="(min-width:1024px) 352px, 320px"
                  className="object-contain p-3"
                />
              </span>
            </Link>
            <p className="mx-auto mt-3 max-w-[20rem] text-[1.0625rem] leading-snug text-foreground/80 lg:mx-0 lg:max-w-[22rem]">
              {t.home.imageCaption}
            </p>
          </div>
        </div>
      </section>

      <section className="shell pb-12 lg:pb-16" aria-labelledby="families-title">
        <h2 id="families-title" className="text-d3 font-semibold">
          {t.home.familiesTitle}
        </h2>
        <ul id="collections" className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4" aria-label={t.home.familiesTitle}>
          {categories.map((c) => (
            <li key={c.key}>
              <Link
                href={c.href}
                className="group flex min-h-20 items-center gap-4 rounded-lg border border-rule bg-background px-3 py-3 transition-colors hover:border-foreground/50 md:h-full md:min-h-0 md:flex-col md:items-stretch md:px-4 md:py-5"
                data-testid="hero-cat"
              >
                <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-[#f5f1eb] md:aspect-square md:h-auto md:w-full md:max-h-36">
                  <Image
                    src={c.image}
                    alt=""
                    fill
                    sizes="(min-width:768px) 220px, 64px"
                    className="object-contain p-1.5"
                  />
                </span>
                <span className="flex min-w-0 flex-1 items-center justify-between gap-3 md:mt-3 md:flex-none md:flex-col md:items-center md:text-center">
                  <span className="text-[1.0625rem] font-semibold leading-snug text-foreground group-hover:text-copper">
                    {familyLabel(c.key)}
                  </span>
                  <ArrowRight className="size-5 shrink-0 text-foreground/70 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 md:mt-1" aria-hidden />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
