"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, FileText, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart, useShop, useT } from "./providers";
import { WhatsAppIcon } from "./icons";
import { waLink } from "@/lib/site";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

export function AddToCart({ id, title, price, url, orderable = true }: { id: string; title: string; price?: number; url: string; orderable?: boolean }) {
  const { t, locale } = useT();
  const { showPrices } = useShop();
  const { add } = useCart();
  const addLabel = showPrices ? t.product.add : t.product.addQuote;
  const addedLabel = showPrices ? t.product.added : t.product.addedQuote;
  const priceTxt = showPrices && price != null && price > 0 ? formatDH(price) : (locale === "ar" ? "السعر على عرض" : "Prix sur devis");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [showBar, setShowBar] = useState(false);
  const zone = useRef<HTMLDivElement>(null);
  const msg =
    locale === "ar"
      ? `السلام عليكم FAW، أريد معلومات عن: ${title} (المرجع ${id}).\n${url}`
      : `Bonjour FAW, je suis intéressé(e) par : ${title} (réf. ${id}).\n${url}`;

  // barre d'achat collante (mobile) : visible tant que le bloc d'achat principal n'est pas à l'écran
  useEffect(() => {
    const el = zone.current;
    if (!el) return;
    let raf = 0;
    // écouteur de scroll (et non IntersectionObserver) : un saut de défilement ne doit pas rater la transition
    const check = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      setShowBar(r.bottom < 0 || r.top > window.innerHeight - 64);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(check); };
    check();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, []);

  const doAdd = (n: number) => {
    add(id, n);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="space-y-3" ref={zone}>
      <div className="flex min-w-0 gap-3">
        <div className="flex h-12 shrink-0 items-center rounded-lg border border-input" role="group" aria-label={t.product.qty}>
          <button type="button" className="grid h-full w-11 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="−1">
            <Minus className="size-4" />
          </button>
          <output className="w-8 text-center text-base font-medium tnum" aria-live="polite" data-testid="qty">{qty}</output>
          <button type="button" className="grid h-full w-11 place-items-center text-muted-foreground hover:text-foreground disabled:opacity-40" onClick={() => setQty((q) => Math.min(99, q + 1))} disabled={qty >= 99} aria-label="+1">
            <Plus className="size-4" />
          </button>
        </div>
        <button type="button" data-testid="add-to-cart" onClick={() => doAdd(qty)} disabled={!orderable} className="btn btn-primary min-w-0 flex-1 whitespace-normal px-3 text-center leading-tight sm:px-5 disabled:cursor-not-allowed disabled:opacity-50">
          {added ? <Check className="size-4 shrink-0" aria-hidden /> : <ShoppingBag className="size-4 shrink-0" aria-hidden />}
          <span aria-live="polite">{!orderable ? t.v4.unavailable : added ? addedLabel : addLabel}</span>
        </button>
      </div>
      {!orderable && <p className="text-sm text-muted-foreground" role="status">{t.v4.notOrderable}</p>}
      <Link href={`/devis?ref=${encodeURIComponent(id)}&qte=${qty}`} data-testid="quote-product" className="btn btn-ghost w-full">
        <FileText className="size-[18px]" aria-hidden /> {t.v4.quoteCtaShort}
      </Link>
      {added && (
        <p className="text-sm">
          <Link href="/panier" className="font-semibold text-copper underline underline-offset-4">{showPrices ? t.nav.cart : t.nav.cartQuote} →</Link>
        </p>
      )}
      <a href={waLink(msg)} target="_blank" rel="noopener" data-testid="wa-product" className="btn btn-ghost w-full">
        <WhatsAppIcon className="size-[18px]" /> {t.product.askWa}
      </a>

      {/* barre collante mobile */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md transition-[translate] duration-300 lg:hidden",
          showBar ? "translate-y-0" : "pointer-events-none translate-y-full",
        )}
        aria-hidden={!showBar}
        data-testid="sticky-buy"
      >
        <div className="shell flex min-h-16 items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground" lang="fr" dir="auto">{title}</p>
            <p className="font-semibold tnum" dir="ltr">{priceTxt}</p>
          </div>
          {orderable ? (
            <button type="button" tabIndex={showBar ? 0 : -1} onClick={() => doAdd(1)} className="btn btn-primary h-11 min-w-0 shrink-0 px-3 whitespace-nowrap" data-testid="sticky-add-to-cart">
              {added ? <Check className="size-4 shrink-0" aria-hidden /> : <ShoppingBag className="size-4 shrink-0" aria-hidden />}
              {added ? addedLabel : (showPrices ? addLabel : t.product.addQuoteShort)}
            </button>
          ) : (
            <Link href={`/devis?ref=${encodeURIComponent(id)}`} tabIndex={showBar ? 0 : -1} className="btn btn-ghost h-11 px-4">{t.v4.quote}</Link>
          )}
        </div>
      </div>
    </div>
  );
}
