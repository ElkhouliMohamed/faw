"use client";
import { itemHref } from "@/lib/products";

import Link from "next/link";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart, useShop, useT } from "@/components/providers";
import { CouponField, DeliverySelector, Totals } from "@/components/cart-parts";
import { Steps } from "@/components/steps";
import { ProductImage } from "@/components/product-image";
import { formatDH } from "@/lib/format";
import { QuoteForm } from "@/app/devis/quote-form";

export function CartView() {
  const { t } = useT();
  const { showPrices } = useShop();
  const { ready, rows, setQty, remove } = useCart();
  const title = showPrices ? t.cart.title : t.cart.titleQuote;
  const empty = showPrices ? t.cart.empty : t.cart.emptyQuote;

  return (
    <div className="shell pt-10 sm:pt-14">
      {showPrices && <Steps current={0} />}
      <h1 className="mt-8 text-d1">{title}</h1>
      {!ready ? (
        <div className="mt-10 h-40 animate-pulse rounded-lg bg-muted" />
      ) : rows.length === 0 ? (
        <div className="mt-10 rounded-lg bg-sand p-12 text-center">
          <ShoppingBag className="mx-auto size-10 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">{empty}</p>
          <Link href="/produits" className="btn btn-primary mt-6">{t.cart.continue}</Link>
        </div>
      ) : showPrices ? (
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-7">
            <ul className="divide-y divide-rule border-y border-rule" data-testid="cart-lines">
                {rows.map(({ product: p, qty, lineTotal }) => {
                  return (
                    <li key={p.id} className="flex gap-4 py-6 sm:gap-6">
                      <Link href={itemHref(p)} className={`relative h-28 w-22 shrink-0 overflow-hidden rounded-lg sm:h-36 sm:w-28 bg-sand`}>
                        <ProductImage src={p.image} alt={p.title} sizes="96px" fit="cover" placeholderLabel="" />
                      </Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="eyebrow text-muted-foreground" dir="ltr">{p.id}</p>
                            <Link href={itemHref(p)} className="mt-1 line-clamp-2 font-medium hover:text-copper" lang="fr" dir="auto">{p.title}</Link>
                            {p.variantLabel && <p className="mt-1 text-xs text-muted-foreground">{p.variantLabel}</p>}
                          </div>
                          <button onClick={() => remove(p.id)} aria-label={`${t.cart.remove} ${p.title}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                          <div className="flex h-10 items-center rounded-lg border border-input" role="group" aria-label={t.product.qty}>
                            <button className="grid h-full w-10 place-items-center hover:bg-sand" onClick={() => setQty(p.id, qty - 1)} aria-label="−1"><Minus className="size-3.5" /></button>
                            <span className="w-8 text-center text-sm tnum" data-testid={`qty-${p.id}`}>{qty}</span>
                            <button className="grid h-full w-10 place-items-center hover:bg-sand" onClick={() => setQty(p.id, qty + 1)} aria-label="+1"><Plus className="size-3.5" /></button>
                          </div>
                          <div className="text-end">
                            <p className="font-semibold tnum" dir="ltr">{formatDH(lineTotal)}</p>
                            {qty > 1 && <p className="text-xs text-muted-foreground" dir="ltr">{qty} × {formatDH(p.price ?? 0)}</p>}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
            </ul>
            <DeliverySelector />
          </div>
          <aside className="lg:col-span-5">
            <div className="sticky top-24 rounded-lg bg-sand p-6 sm:p-8">
              <h2 className="text-lg font-semibold">{t.checkout.summary}</h2>
              <div className="mt-4"><CouponField /></div>
              <Totals className="mt-4" />
              <Link href="/commande" data-testid="go-checkout" className="mt-6 btn btn-primary w-full">
                {t.cart.checkout} <ArrowRight className="size-4 rtl:rotate-180" />
              </Link>
              <Link href="/devis?panier=1" data-testid="cart-quote" className="mt-3 btn btn-ghost w-full">
                {t.v4.quoteCta}
              </Link>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t.cart.note}</p>
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          <ul className="divide-y divide-rule border-y border-rule" data-testid="cart-lines">
            {rows.map(({ product: p, qty }) => (
              <li key={p.id} className="flex gap-4 py-6 sm:gap-6">
                <Link href={itemHref(p)} className="relative h-28 w-22 shrink-0 overflow-hidden rounded-lg bg-sand sm:h-36 sm:w-28">
                  <ProductImage src={p.image} alt={p.title} sizes="96px" fit="cover" placeholderLabel="" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="eyebrow text-muted-foreground" dir="ltr">{p.id}</p>
                      <Link href={itemHref(p)} className="mt-1 line-clamp-2 font-medium hover:text-copper" lang="fr" dir="auto">{p.title}</Link>
                      {p.variantLabel && <p className="mt-1 text-xs text-muted-foreground">{p.variantLabel}</p>}
                    </div>
                    <button onClick={() => remove(p.id)} aria-label={`${t.cart.remove} ${p.title}`} className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                    <div className="flex h-10 items-center rounded-lg border border-input" role="group" aria-label={t.product.qty}>
                      <button className="grid h-full w-10 place-items-center hover:bg-sand" onClick={() => setQty(p.id, qty - 1)} aria-label="−1"><Minus className="size-3.5" /></button>
                      <span className="w-8 text-center text-sm tnum" data-testid={`qty-${p.id}`}>{qty}</span>
                      <button className="grid h-full w-10 place-items-center hover:bg-sand" onClick={() => setQty(p.id, qty + 1)} aria-label="+1"><Plus className="size-3.5" /></button>
                    </div>
                    <p className="text-sm text-muted-foreground">Qté {qty} · Prix sur devis</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <QuoteForm fromCart embedded initialQty={1} />
        </div>
      )}
    </div>
  );
}
