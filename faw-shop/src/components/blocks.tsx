import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import type { Block } from "@/lib/blocks";
import { getDict } from "@/lib/i18n-server";
import { toPublic, type Product } from "@/lib/products";
import { stripPriceMentions } from "@/lib/format";

const isExt = (u: string) => /^https:\/\//.test(u);
function Cta({ href, children, testid, variant = "primary" }: { href: string; children: React.ReactNode; testid: string; variant?: "primary" | "ghost" }) {
  const cls = `btn ${variant === "primary" ? "btn-primary" : "btn-ghost"} mt-6`;
  return isExt(href) ? (
    <a href={href} target="_blank" rel="noopener" className={cls} data-testid={testid}>{children}</a>
  ) : (
    <Link href={href} className={cls} data-testid={testid}>{children}</Link>
  );
}
/** Texte brut : paragraphes séparés par une ligne vide (aucun HTML interprété). */
const paras = (s: string) => s.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

/** Rendu des blocs (landing pages, accueil, pages techniques). Le premier bandeau porte le H1. */
export async function Blocks({ blocks, products, hasH1 = false, showPrices = false }: { blocks: Block[]; products: Product[]; hasH1?: boolean; showPrices?: boolean }) {
  const { t } = await getDict();
  const byId = new Map(products.map((p) => [p.id, p]));
  let h1Done = hasH1;
  return (
    <>
      {blocks.map((b, i) => {
        if (b.type === "hero") {
          const H = h1Done ? "h2" : "h1";
          h1Done = true;
          return (
            <section key={i} className="shell grid items-center gap-8 pt-10 sm:pt-16 lg:grid-cols-2" data-block="hero">
              <div>
                <H className={H === "h1" ? "text-d1" : "text-d2"}>{b.title}</H>
                {b.subtitle && <p className="mt-4 max-w-xl text-lg text-muted-foreground">{showPrices ? b.subtitle : stripPriceMentions(b.subtitle)}</p>}
                {b.ctaLabel && b.ctaUrl && <Cta href={b.ctaUrl} testid="block-hero-cta">{b.ctaLabel}</Cta>}
              </div>
              {b.image && (
                <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
                  <Image src={b.image} alt="" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" priority={i === 0} />
                </div>
              )}
            </section>
          );
        }
        if (b.type === "products") {
          const list = b.ids.map((id) => byId.get(id)).filter((p): p is Product => !!p);
          if (!list.length) return null;
          return (
            <section key={i} className="shell pt-14" data-block="products">
              {b.title && <h2 className="text-d3">{b.title}</h2>}
              <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {list.map((p) => {
                  const pp = toPublic(p, showPrices);
                  return (
                    <li key={p.id}>
                      <ProductCard p={pp} catLabel={t.cats[pp.cat]} noImage={t.product.noImage} sizes="(min-width:1024px) 25vw, 46vw" />
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }
        if (b.type === "text")
          return (
            <section key={i} className="shell max-w-3xl pt-14" data-block="text">
              {b.title && <h2 className="text-d3">{b.title}</h2>}
              <div className="mt-4 space-y-4 text-base leading-relaxed">
                {paras(showPrices ? b.body : stripPriceMentions(b.body)).map((p, j) => <p key={j} className="whitespace-pre-line">{p}</p>)}
              </div>
            </section>
          );
        if (b.type === "faq")
          return (
            <section key={i} className="shell max-w-3xl pt-14" data-block="faq">
              <h2 className="text-d3">{b.title || "Questions fréquentes"}</h2>
              <div className="mt-4 divide-y divide-rule border-y border-rule">
                {b.items.map((f, j) => (
                  <details key={j} className="group py-4">
                    <summary className="cursor-pointer list-none font-semibold">{showPrices ? f.q : stripPriceMentions(f.q)}</summary>
                    <p className="mt-2 whitespace-pre-line text-muted-foreground">{showPrices ? f.a : stripPriceMentions(f.a)}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        return (
          <section key={i} className="shell pt-14" data-block="cta">
            <div className="rounded-2xl border border-rule bg-sand p-6 sm:p-10">
              <h2 className="text-d3">{b.title}</h2>
              {b.text && <p className="mt-2 max-w-2xl text-muted-foreground">{b.text}</p>}
              <Cta href={b.url} testid="block-cta">{b.label}</Cta>
            </div>
          </section>
        );
      })}
    </>
  );
}

export const blocksFaq = (blocks: Block[]) => blocks.flatMap((b) => (b.type === "faq" ? b.items : []));
