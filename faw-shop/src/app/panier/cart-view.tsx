"use client";

import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { useCart, useShop, useT } from "@/components/providers";
import { CouponField, DeliverySelector } from "@/components/cart-parts";
import { CartLines, CartToQuote, ServerTotals, useCartPreview } from "@/components/cart-summary";
import { Steps } from "@/components/steps";
import { commerceDict } from "@/lib/commerce-dict";
import { QuoteForm } from "@/app/devis/quote-form";

/** Page panier : mêmes lignes que le panier latéral, totaux recalculés par Laravel, commande ou demande de devis. */
export function CartView() {
  const { t, locale } = useT();
  const c = commerceDict(locale);
  const { showPrices } = useShop();
  const { ready, rows } = useCart();
  const preview = useCartPreview();
  const title = showPrices ? t.cart.title : t.cart.titleQuote;
  const empty = showPrices ? t.cart.empty : t.cart.emptyQuote;
  const blocked = rows.some((r) => r.product.quoteOnly) || !!preview.data?.quoteRequired;

  return (
    <div className="-mb-20 bg-paper pb-20 lg:-mb-28 lg:pb-28">
      <div className="shell pt-8 sm:pt-12">
        {showPrices && <Steps current={0} />}
        <h1 className="mt-6 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] leading-tight font-bold text-ink dark:text-foreground">{title}</h1>
        {!ready ? (
          <div className="mt-8 h-48 animate-pulse rounded-2xl bg-sand" />
        ) : rows.length === 0 ? (
          <div className="mt-8 rounded-2xl bg-card p-12 text-center shadow-soft">
            <span className="mx-auto grid size-20 place-items-center rounded-full bg-sand text-copper" aria-hidden>
              <ShoppingBag className="size-9" strokeWidth={1.5} />
            </span>
            <p className="mt-4 text-muted-foreground">{empty}</p>
            <Link href="/produits" className="btn btn-primary mt-6 rounded-xl">{t.cart.continue}</Link>
          </div>
        ) : showPrices ? (
          <div className="mt-8 grid items-start gap-8 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-7">
              <CartLines preview={preview} />
              <div className="rounded-2xl bg-card p-5 shadow-soft sm:p-6">
                <DeliverySelector />
              </div>
            </div>
            <aside className="lg:sticky lg:top-24 lg:col-span-5">
              <div className="rounded-2xl bg-card p-6 shadow-soft sm:p-7">
                <h2 className="text-lg font-bold">{c.cart.summary}</h2>
                <div className="mt-4"><CouponField /></div>
                <ServerTotals preview={preview} className="mt-5" />
                {!blocked && (
                  <Link href="/commande" data-testid="go-checkout" className="btn btn-primary mt-6 h-13 w-full rounded-xl text-base shadow-soft">
                    {c.cart.order} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                  </Link>
                )}
                <CartToQuote className="mt-3" primary={blocked} />
              </div>
            </aside>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            <CartLines preview={preview} />
            <QuoteForm fromCart embedded initialQty={1} />
          </div>
        )}
      </div>
    </div>
  );
}
