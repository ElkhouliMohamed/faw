import { ArrowRight, DoorClosed } from "lucide-react";
import type { HomeSectionOf } from "@/lib/site-content";
import { itemHref, type PublicProduct } from "@/lib/products";
import { Price } from "@/components/price";
import { Eyebrow, PillLink, Photo, SectionTitle, SmartLink } from "./ui";

type Card = { key: string; title: string; text: React.ReactNode; image: string; alt: string; url: string; fit: "cover" | "contain" };

/**
 * Produits : sur-titre, titre, texte, lien « pilule » ; cartes (photo sur fond clair, nom, ligne grise, bouton rond orange).
 * Cartes saisies dans Filament, puis produits du catalogue choisis (ou derniers produits d'une catégorie), même présentation.
 */
export function ProductsShowcase({
  s,
  products,
  catLabel,
  index,
  photoSoon,
}: {
  s: HomeSectionOf<"products">;
  products: PublicProduct[];
  catLabel: (p: PublicProduct) => string;
  index: number;
  photoSoon: string;
}) {
  const cards: Card[] = [
    ...s.cards.map((c, i) => ({ key: `c${i}`, title: c.title, text: c.text, image: c.image, alt: c.imageAlt || c.title, url: c.url, fit: "contain" as const })),
    ...products.map((p) => ({
      key: p.id,
      title: p.title,
      text: p.price != null ? <Price price={p.price} compareAt={p.compareAt} /> : catLabel(p),
      image: p.image ?? "",
      alt: p.title,
      url: itemHref(p),
      fit: "contain" as const,
    })),
  ];
  if (!cards.length && !s.title) return null;
  const id = `home-products-${index}`;
  return (
    <section id={s.anchor || undefined} className="shell scroll-mt-28 pt-16 lg:pt-24" aria-labelledby={s.title ? id : undefined} data-section="products">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="max-w-2xl">
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <SectionTitle id={id} className="mt-3">{s.title}</SectionTitle>}
          {s.subtitle && <p className="mt-3 max-w-[60ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{s.subtitle}</p>}
        </div>
        {s.linkLabel && s.linkUrl && <PillLink href={s.linkUrl}>{s.linkLabel}</PillLink>}
      </div>
      {cards.length > 0 && (
        <ul className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {cards.map((c) => {
            const body = (
              <>
                <span className="relative block aspect-[3/2] overflow-hidden bg-[linear-gradient(180deg,#f0efeb,#e8e3dd)] dark:bg-[linear-gradient(180deg,var(--sand),var(--muted))]">
                  <Photo src={c.image} alt="" fit={c.fit} sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 92vw" className={`${c.fit === "contain" ? "object-bottom px-4 pt-4" : "object-[center_6%]"} transition-transform duration-500 group-hover:scale-[1.03]`} placeholder={photoSoon} icon={DoorClosed} />
                </span>
                <span className="flex items-center justify-between gap-3 px-5 py-4">
                  <span className="min-w-0">
                    <span className="block font-bold leading-snug text-foreground">{c.title}</span>
                    {c.text && <span className="mt-0.5 block text-[0.8125rem] text-muted-foreground">{c.text}</span>}
                  </span>
                  {c.url && (
                    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-flame text-white transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
                      <ArrowRight className="size-4 rtl:rotate-180" strokeWidth={2.4} />
                    </span>
                  )}
                </span>
              </>
            );
            const cls = "group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-rule/70 transition-shadow hover:shadow-[0_18px_40px_-20px_rgb(58_36_22/0.35)]";
            return (
              <li key={c.key}>
                {c.url ? (
                  <SmartLink href={c.url} className={cls}>{body}</SmartLink>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
