import type { Metadata } from "next";
import Link from "next/link";
import { ProductImage } from "@/components/product-image";
import { QuickAdd } from "@/components/quick-add";
import { Price } from "@/components/price";
import { allProducts } from "@/lib/catalog";
import { getDict } from "@/lib/i18n-server";
import { shopConfig } from "@/lib/merch";
import { publicConfig } from "@/lib/public-config";
import { alternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Packs – FAW Aluminium",
    description: "Packs FAW Aluminium à Casablanca : produits regroupés, prix sur devis.",
    alternates: await alternates("/packs"),
  };
}

export default async function PacksPage() {
  const { t } = await getDict();
  const showPrices = (await publicConfig())?.shop?.showPrices === true;
  const packs = (await shopConfig(await allProducts(), showPrices)).packs;
  return (
    <div className="shell pt-10 sm:pt-16">
      <p className="eyebrow text-copper">FAW · Casablanca</p>
      <h1 className="mt-3 text-d1">{t.mod.packs}</h1>
      {packs.length === 0 ? (
        <p className="mt-8 text-muted-foreground" data-testid="packs-empty">
          Aucun pack pour le moment. <Link href="/produits" className="font-semibold text-copper underline-offset-4 hover:underline">{t.shop.title} →</Link>
        </p>
      ) : (
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3" data-testid="packs-list">
          {packs.map((b) => (
            <li key={b.slug} id={b.slug} className="flex scroll-mt-28 flex-col rounded-2xl border border-rule p-4" data-testid="pack-card">
              <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-sand">
                <ProductImage src={b.image} alt="" reference={b.product.id} placeholderLabel={t.product.noImage} fit="contain" sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 92vw" className="p-[8%] mix-blend-multiply" />
              </div>
              <h2 className="mt-4 text-lg font-semibold" lang="fr" dir="auto">{b.product.title}</h2>
              {b.description && <p className="mt-1 text-sm text-muted-foreground" lang="fr">{b.description}</p>}
              <p className="mt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t.mod.packIncludes}</p>
              <ul className="mt-1 space-y-1 text-sm" lang="fr" dir="ltr">
                {b.items.map((it) => (
                  <li key={it.id} className="flex gap-2"><span className="tnum text-muted-foreground">{it.qty}×</span><span>{it.title}</span></li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3 pt-5">
                <p className="text-lg font-semibold tnum text-price">
                  <span className="sr-only">{t.mod.packPrice} : </span>
                  <Price price={b.price} compareAt={b.compareAt} wasLabel={t.mod.was} onQuote={!showPrices} />
                </p>
                <div className="flex min-w-0 flex-col gap-2">
                  <QuickAdd id={b.product.id} title={b.product.title} disabled={!b.product.orderable} />
                  <Link href={`/devis?ref=${encodeURIComponent(b.product.id)}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-rule px-3 text-sm font-semibold hover:border-foreground/40" data-testid="pack-quote">
                    {t.mod.packQuote}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
