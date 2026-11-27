import Image from "next/image";
import Link from "next/link";
import { ArrowRight, FileText, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import type { HomeSectionOf } from "@/lib/site-content";
import type { PublicProduct } from "@/lib/products";
import type { ContentPage } from "@/lib/content";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icon";

// Sections de l'accueil (composants serveur, aucun JS client). Données : Filament (Accueil) ou accueil par défaut.
// Les textes viennent des sections ; seuls les libellés d'interface (aria, « Lire ») sont ici.

const isExternal = (url: string) => /^https:\/\//.test(url);
/** Sections sous le premier écran : rendu différé par le navigateur (content-visibility), sans décalage de mise en page. */
const BELOW_FOLD = "[content-visibility:auto] [contain-intrinsic-size:auto_640px]";

function SmartLink({ href, className, children, testid }: { href: string; className?: string; children: React.ReactNode; testid?: string }) {
  return isExternal(href) ? (
    <a href={href} target="_blank" rel="noopener" className={className} data-testid={testid}>{children}</a>
  ) : (
    <Link href={href} className={className} data-testid={testid}>{children}</Link>
  );
}

function SectionHead({ id, title, subtitle, action }: { id: string; title?: string; subtitle?: string; action?: React.ReactNode }) {
  if (!title && !subtitle && !action) return null;
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="max-w-2xl">
        {title && <h2 id={id} className="text-d3 font-semibold">{title}</h2>}
        {subtitle && <p className="mt-2 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------ Bannière ------------------------------ */

export type HeroContact = { phone: string; phoneHref: string; whatsappDisplay: string; whatsappHref: string };

export function HeroSection({ s, contact, labels, caption, h1 = true }: { s: HomeSectionOf<"hero">; contact: HeroContact; labels: { call: string; message: string }; caption?: string; h1?: boolean }) {
  const H = h1 ? "h1" : "h2";
  return (
    <section className="shell pt-8 pb-10 sm:pt-12 lg:pt-16 lg:pb-14" aria-labelledby="hero-title" data-section="hero">
      <div className="grid-12 items-center gap-y-10">
        <div className={cn("col-span-12 lg:pe-6 xl:pe-10", s.image ? "lg:col-span-6" : "lg:col-span-9")}>
          {s.eyebrow && <p className="eyebrow text-copper">{s.eyebrow}</p>}
          <H id="hero-title" className="mt-4 max-w-[16ch] text-d1 font-semibold text-balance">{s.title}</H>
          {s.subtitle && <p className="mt-5 max-w-[42ch] text-[1.125rem] leading-relaxed text-foreground sm:text-lead">{s.subtitle}</p>}

          <div className="mt-8 flex flex-col gap-3">
            {s.primaryLabel && s.primaryUrl && (
              <SmartLink href={s.primaryUrl} className="btn btn-cta h-14 min-h-14 w-full px-6 text-[1.125rem] sm:w-auto sm:self-start" testid="hero-quote">
                <FileText className="size-5 shrink-0" aria-hidden />
                {s.primaryLabel}
              </SmartLink>
            )}
            {s.showContact && (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a href={contact.phoneHref} className="btn btn-ghost h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 sm:w-auto" data-testid="hero-call">
                  <Phone className="size-5 shrink-0" aria-hidden />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-start">
                    <span className="text-[1.0625rem] font-semibold leading-tight">{labels.call}</span>
                    <span dir="ltr" className="text-[1.0625rem] font-medium leading-tight tnum">{contact.phone}</span>
                  </span>
                </a>
                <a href={contact.whatsappHref} target="_blank" rel="noopener" className="btn btn-ghost h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 sm:w-auto" data-testid="hero-message">
                  <WhatsAppIcon className="size-5 shrink-0" />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-start">
                    <span className="text-[1.0625rem] font-semibold leading-tight">{labels.message}</span>
                    <span dir="ltr" className="text-[1.0625rem] font-medium leading-tight tnum">{contact.whatsappDisplay}</span>
                  </span>
                </a>
              </div>
            )}
            {s.secondaryLabel && s.secondaryUrl && (
              <SmartLink
                href={s.secondaryUrl}
                className="group inline-flex min-h-12 items-center gap-2 self-start pt-1 text-[1.0625rem] font-semibold underline decoration-rule underline-offset-4 hover:text-copper hover:decoration-copper"
                testid="hero-shop"
              >
                {s.secondaryLabel}
                <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" aria-hidden />
              </SmartLink>
            )}
          </div>
        </div>

        {s.image && (
          <div className="col-span-12 lg:col-span-5 lg:col-start-8">
            <div className="relative mx-auto block w-full max-w-[20rem] lg:ms-0 lg:max-w-[22rem]">
              <span className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-[#f5f1eb]">
                <Image src={s.image} alt={s.imageAlt} fill priority fetchPriority="high" sizes="(min-width:1024px) 352px, (min-width:360px) 320px, 90vw" className="object-contain p-3" />
              </span>
            </div>
            {caption && <p className="mx-auto mt-3 max-w-[20rem] text-[1.0625rem] leading-snug text-foreground/80 lg:mx-0 lg:max-w-[22rem]">{caption}</p>}
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------ Catégories ------------------------------ */

export type CategoryTile = { key: string; label: string; href: string; image: string | null };

export function CategoriesSection({ s, items, index }: { s: HomeSectionOf<"categories">; items: CategoryTile[]; index: number }) {
  if (!items.length) return null;
  const id = `home-cats-${index}`;
  return (
    <section className={cn("shell pb-12 lg:pb-16", index > 1 && BELOW_FOLD)} aria-labelledby={s.title ? id : undefined} aria-label={s.title ? undefined : "Catégories"} data-section="categories">
      <SectionHead id={id} title={s.title} subtitle={s.subtitle} />
      <ul id="collections" className={cn("grid grid-cols-1 gap-3 md:gap-4", items.length >= 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3", (s.title || s.subtitle) && "mt-6")}>
        {items.map((c) => (
          <li key={c.key}>
            <Link
              href={c.href}
              className="group flex min-h-20 items-center gap-4 rounded-lg border border-rule bg-background px-3 py-3 transition-colors hover:border-foreground/50 md:h-full md:min-h-0 md:flex-col md:items-stretch md:px-4 md:py-5"
              data-testid="hero-cat"
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-md bg-[#f5f1eb] md:aspect-square md:h-auto md:w-full md:max-h-36">
                {c.image && <Image src={c.image} alt="" fill sizes="(min-width:1280px) 260px, (min-width:768px) 220px, 64px" className="object-contain p-1.5" />}
              </span>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-3 md:mt-3 md:flex-none md:flex-col md:items-center md:text-center">
                <span className="text-[1.0625rem] font-semibold leading-snug text-foreground group-hover:text-copper">{c.label}</span>
                <ArrowRight className="size-5 shrink-0 text-foreground/70 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 md:mt-1" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Produits ------------------------------ */

export function ProductsSection({ s, products, catLabel, noImage, index }: { s: HomeSectionOf<"products">; products: PublicProduct[]; catLabel: (p: PublicProduct) => string; noImage: string; index: number }) {
  if (!products.length) return null;
  const id = `home-products-${index}`;
  const action =
    s.linkLabel && s.linkUrl ? (
      <SmartLink href={s.linkUrl} className="group inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-rule underline-offset-4 hover:text-copper">
        {s.linkLabel} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
      </SmartLink>
    ) : undefined;
  return (
    <section className={cn("shell pb-12 lg:pb-16", index > 1 && BELOW_FOLD)} aria-labelledby={s.title ? id : undefined} data-section="products">
      <SectionHead id={id} title={s.title} subtitle={s.subtitle} action={action} />
      <ul className="mt-6 grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-4 lg:grid-cols-4">
        {products.map((p) => (
          <li key={p.id} className="min-w-0">
            <ProductCard p={p} catLabel={catLabel(p)} noImage={noImage} sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 46vw" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Pourquoi FAW ------------------------------ */

export function UspsSection({ s, index }: { s: HomeSectionOf<"usps">; index: number }) {
  if (!s.items.length) return null;
  const id = `home-usps-${index}`;
  return (
    <section className={cn("shell pb-12 lg:pb-16", index > 1 && BELOW_FOLD)} aria-labelledby={s.title ? id : undefined} data-section="usps">
      <SectionHead id={id} title={s.title} subtitle={s.subtitle} />
      <ul className={cn("hairline mt-6 grid gap-6 pt-8 sm:grid-cols-2", s.items.length % 3 === 0 ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        {s.items.map((item, i) => {
          return (
            <li key={i} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-copper" aria-hidden>
                <HomeIcon name={item.icon} className="size-5" strokeWidth={2} fallback="badge-check" />
              </span>
              <div className="min-w-0">
                <h3 className="text-[1.0625rem] font-semibold leading-snug">{item.title}</h3>
                {item.text && <p className="mt-1 text-[0.9375rem] leading-relaxed text-muted-foreground">{item.text}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------ Références ------------------------------ */

export function ReferencesSection({ s, index }: { s: HomeSectionOf<"references">; index: number }) {
  const logos = s.logos.filter((l) => l.image);
  if (!logos.length) return null;
  const id = `home-refs-${index}`;
  return (
    <section className={cn("shell pb-12 lg:pb-16", BELOW_FOLD)} aria-labelledby={s.title ? id : undefined} data-section="references">
      <SectionHead id={id} title={s.title} subtitle={s.subtitle} />
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {logos.map((l, i) => {
          const img = (
            <span className="relative block h-12 w-full">
              <Image src={l.image} alt={l.name} fill sizes="(min-width:1024px) 180px, (min-width:640px) 30vw, 45vw" className="object-contain opacity-80 grayscale transition hover:opacity-100 hover:grayscale-0" />
            </span>
          );
          return (
            <li key={i} className="flex min-h-20 items-center rounded-lg border border-rule px-4 py-3">
              {l.url ? (
                <a href={l.url} target={isExternal(l.url) ? "_blank" : undefined} rel={isExternal(l.url) ? "noopener" : undefined} className="block w-full">{img}</a>
              ) : (
                img
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------ Témoignages ------------------------------ */

export function TestimonialsSection({ s, index }: { s: HomeSectionOf<"testimonials">; index: number }) {
  if (!s.items.length) return null;
  const id = `home-testimonials-${index}`;
  return (
    <section className={cn("pb-12 lg:pb-16", BELOW_FOLD)} aria-labelledby={s.title ? id : undefined} data-section="testimonials">
      <div className="shell">
        <SectionHead id={id} title={s.title} subtitle={s.subtitle} />
      </div>
      {/* mobile : défilement horizontal natif (scroll-snap), sans JS ; grille à partir de 768 px */}
      <ul className="no-scrollbar shell mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible lg:grid-cols-3">
        {s.items.map((item, i) => (
          <li key={i} className="w-[85%] shrink-0 snap-start md:w-auto">
            <figure className="flex h-full flex-col rounded-lg border border-rule bg-card p-6">
              <blockquote className="flex-1 text-[1.0625rem] leading-relaxed">« {item.quote} »</blockquote>
              <figcaption className="mt-5 border-t border-rule pt-4 text-sm">
                <span className="font-semibold">{item.author}</span>
                {item.role && <span className="block text-muted-foreground">{item.role}</span>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------ Blog ------------------------------ */

export function BlogSection({ s, posts, readLabel, allLabel, index }: { s: HomeSectionOf<"blog">; posts: ContentPage[]; readLabel: string; allLabel: string; index: number }) {
  if (!posts.length) return null;
  const id = `home-blog-${index}`;
  return (
    <section className={cn("shell pb-12 lg:pb-16", BELOW_FOLD)} aria-labelledby={s.title ? id : undefined} data-section="blog">
      <SectionHead
        id={id}
        title={s.title}
        action={
          <Link href="/blog" className="inline-flex min-h-11 items-center gap-1.5 font-semibold underline decoration-rule underline-offset-4 hover:text-copper">
            {allLabel} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
        }
      />
      <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, s.count).map((p) => (
          <li key={p.slug}>
            <article className="group flex h-full flex-col">
              <Link href={`/blog/${p.slug}`} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden rounded-lg bg-sand">
                {p.image && <Image src={p.image} alt="" fill sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 92vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />}
              </Link>
              <h3 className="mt-4 text-[1.125rem] font-semibold leading-snug">
                <Link href={`/blog/${p.slug}`} className="hover:text-copper">{p.title}</Link>
              </h3>
              {p.excerpt && <p className="mt-2 line-clamp-3 text-[0.9375rem] text-muted-foreground">{p.excerpt}</p>}
              <Link href={`/blog/${p.slug}`} className="mt-3 inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-copper">
                {readLabel} <span className="sr-only">: {p.title}</span> <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Link>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
