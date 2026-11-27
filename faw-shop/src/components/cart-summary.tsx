"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, FileText, Info, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useCart, useShop, useT } from "./providers";
import { ProductImage } from "./product-image";
import { getCartPreview } from "@/app/actions/cart";
import type { CartPreview } from "@/lib/commerce";
import { commerceDict } from "@/lib/commerce-dict";
import { formatMAD, htOf } from "@/lib/money";
import { itemHref } from "@/lib/products";
import { cn } from "@/lib/utils";

export type PricedPreview = Extract<CartPreview, { pricesHidden: false }>;
export type PreviewState = { loading: boolean; data: PricedPreview | null; error: boolean };

/**
 * Récapitulatif du panier calculé par Laravel (prix, promotions, livraison, code promo, TVA, paiements).
 * Recalculé à chaque changement de lignes, de livraison ou de code promo (anti-rebond 250 ms).
 */
export function useCartPreview(enabled = true): PreviewState {
  const { ready, lines, mode, coupon } = useCart();
  const { showPrices } = useShop();
  const [state, setState] = useState<PreviewState>({ loading: true, data: null, error: false });
  const seq = useRef(0);
  const key = JSON.stringify([lines, mode, coupon?.code ?? null]);
  useEffect(() => {
    if (!ready || !enabled) return;
    if (!showPrices || !lines.length) {
      setState({ loading: false, data: null, error: false });
      return;
    }
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      const r = await getCartPreview({ items: lines.map(({ id, qty }) => ({ id, qty })), deliveryMode: mode, pickup: mode === "retrait", coupon: coupon?.code ?? null }).catch(() => null);
      if (id !== seq.current) return;
      setState({ loading: false, data: r && !r.pricesHidden ? r : null, error: !r });
    }, 250);
    return () => clearTimeout(t);
    // key résume lignes + mode + code promo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, enabled, showPrices, key]);
  return state;
}

/** Totaux HT / TVA / TTC du serveur (jamais recalculés dans le navigateur). */
export function ServerTotals({ preview, className }: { preview: PreviewState; className?: string }) {
  const { locale } = useT();
  const c = commerceDict(locale);
  const { data, loading, error } = preview;
  if (!data) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)} data-testid="totals-pending" aria-live="polite">
        {loading ? <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden />{c.cart.computing}</span> : error ? c.cart.error : null}
      </div>
    );
  }
  if (data.quoteRequired || data.totalTtc == null) {
    return (
      <p className={cn("flex gap-2 rounded-lg border border-copper/40 bg-card p-3 text-sm", className)} role="status" data-testid="quote-required">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden /> {c.cart.quoteNeeded}
      </p>
    );
  }
  const fee = data.shipping.fee ?? 0;
  const feeLabel = data.deliveryMode === "retrait" ? c.cart.free : fee > 0 ? formatMAD(fee) : c.cart.toConfirm;
  return (
    <div className={cn("space-y-3", className)} aria-busy={loading}>
      <dl className={cn("space-y-2 text-sm transition-opacity", loading && "opacity-60")}>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{c.cart.subtotalHt}</dt>
          <dd className="tnum" dir="ltr" data-testid="subtotal-ht">{formatMAD(data.subtotalHt ?? 0)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{c.cart.subtotalTtc}</dt>
          <dd className="tnum" dir="ltr" data-testid="subtotal">{formatMAD(data.subtotalTtc ?? 0)}</dd>
        </div>
        {data.coupon && (data.discount ?? 0) > 0 && (
          <div className="flex justify-between gap-4" data-testid="coupon-line">
            <dt className="text-muted-foreground">{c.cart.discount} <span className="font-mono text-xs">{data.coupon}</span></dt>
            <dd className="tnum" dir="ltr">−{formatMAD(data.discount ?? 0)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{c.cart.shipping}</dt>
          <dd className="tnum text-end" dir="auto" data-testid="delivery-fee">{feeLabel}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-rule pt-2">
          <dt className="text-muted-foreground">{c.cart.totalHt}</dt>
          <dd className="tnum" dir="ltr" data-testid="total-ht">{formatMAD(data.totalHt ?? 0)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">{c.cart.tva}</dt>
          <dd className="tnum" dir="ltr" data-testid="tva">{formatMAD(data.tva ?? 0)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
          <dt className="font-semibold">{c.cart.totalTtc}</dt>
          <dd className="text-d3 font-semibold tnum text-price" dir="ltr" data-testid="total">{formatMAD(data.totalTtc)}</dd>
        </div>
      </dl>
      {data.couponError && <p className="text-xs text-destructive" role="alert" data-testid="coupon-server-error">{data.couponError}</p>}
      <p className="flex gap-1.5 text-xs text-muted-foreground" lang="fr"><Info className="mt-px size-3.5 shrink-0" aria-hidden />{data.shipping.label}</p>
    </div>
  );
}

/**
 * Lignes du panier : quantité modifiable, suppression, prix serveur TTC + HT, alertes « sur devis » / quantité max.
 * `compact` : version du panier latéral et du récapitulatif (vignette plus petite, sans référence).
 */
export function CartLines({ preview, compact = false, onNavigate }: { preview: PreviewState; compact?: boolean; onNavigate?: () => void }) {
  const { locale } = useT();
  const c = commerceDict(locale);
  const { rows, setQty, remove } = useCart();
  const byId = new Map((preview.data?.items ?? []).map((i) => [i.id, i]));
  return (
    <ul className={cn(compact ? "space-y-3" : "divide-y divide-rule rounded-2xl border border-rule bg-card px-4 shadow-soft sm:px-6")} data-testid="cart-lines">
      {rows.map(({ product: p, qty }) => {
        const line = byId.get(p.id);
        // Article sur devis : jamais de prix, même si le serveur n'a pas encore répondu.
        const unit = p.quoteOnly ? null : line?.unitTtc ?? p.price ?? null;
        const total = p.quoteOnly ? null : line?.totalTtc ?? (unit != null ? unit * qty : null);
        const blocker = line?.blocker ?? (p.quoteOnly ? "quote_only" : p.maxOnlineQty && qty > p.maxOnlineQty ? "over_max" : null);
        const max = line?.maxOnlineQty ?? p.maxOnlineQty ?? null;
        return (
          <li key={p.id} className={cn("flex gap-3", compact ? "rounded-2xl border border-rule bg-card p-3" : "gap-4 py-5 sm:gap-6")} data-testid="cart-line">
            <Link
              href={itemHref(p)}
              onClick={onNavigate}
              className={cn("relative shrink-0 overflow-hidden rounded-xl bg-sand", compact ? "size-20" : "h-28 w-24 sm:h-32 sm:w-28")}
              tabIndex={-1}
              aria-hidden
            >
              <ProductImage src={p.image} alt="" sizes="112px" fit="cover" placeholderLabel="" />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  {!compact && <p className="eyebrow text-muted-foreground" dir="ltr">{p.id}</p>}
                  <Link href={itemHref(p)} onClick={onNavigate} className={cn("line-clamp-2 font-semibold leading-snug hover:text-copper", compact ? "text-sm" : "mt-1")} lang="fr" dir="auto">
                    {p.title}
                  </Link>
                  {p.variantLabel && <p className="mt-0.5 text-xs text-muted-foreground" lang="fr" dir="auto">{p.variantLabel}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground tnum" data-testid={`unit-${p.id}`}>
                    {unit != null ? <bdi dir="ltr">{compact ? `${formatMAD(unit)} TTC` : `${formatMAD(unit)} TTC · ${formatMAD(line?.unitHt ?? htOf(unit))} HT`}</bdi> : c.price.onQuote}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(p.id)}
                  aria-label={`${c.cart.remove} ${p.title}`}
                  className="-me-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-sand hover:text-destructive"
                  data-testid={`remove-${p.id}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              {blocker && (
                <p className="mt-1.5 flex gap-1.5 text-xs font-medium text-copper" role="status" data-testid={`blocker-${p.id}`}>
                  <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
                  {blocker === "over_max" && max ? c.cart.lineOverMax(max) : blocker === "unavailable" ? c.cart.lineUnavailable : c.cart.lineQuoteOnly}
                </p>
              )}
              <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                <QtyStepper id={p.id} title={p.title} qty={qty} onChange={(n) => setQty(p.id, n)} size={compact ? "xs" : "sm"} />
                {total != null && (
                  <p className={cn("font-bold tnum", compact && "text-sm")} dir="ltr" data-testid={`line-total-${p.id}`}>{formatMAD(total)}</p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Quantité : boutons −/+ et saisie directe (1 à 999). */
export function QtyStepper({ id, title, qty, onChange, size = "sm" }: { id: string; title: string; qty: number; onChange: (n: number) => void; size?: "xs" | "sm" | "lg" }) {
  const { locale } = useT();
  const c = commerceDict(locale);
  const [draft, setDraft] = useState(String(qty));
  useEffect(() => setDraft(String(qty)), [qty]);
  const commit = (v: string) => {
    const n = Math.max(1, Math.min(999, Number(v.replace(/\D/g, "")) || 1));
    setDraft(String(n));
    if (n !== qty) onChange(n);
  };
  const h = size === "lg" ? "h-12" : size === "xs" ? "h-9" : "h-10";
  const w = size === "lg" ? "w-11" : size === "xs" ? "w-9" : "w-10";
  return (
    <div className={cn("flex items-center rounded-xl border border-input bg-card", h)} role="group" aria-label={`${c.cart.qty} ${title}`} dir="ltr">
      <button type="button" className={cn("grid h-full place-items-center rounded-lg hover:bg-sand disabled:opacity-40", w)} onClick={() => onChange(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label="−1">
        <Minus className="size-3.5" aria-hidden />
      </button>
      <input
        value={draft}
        inputMode="numeric"
        aria-label={c.cart.qty}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 3))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit((e.target as HTMLInputElement).value);
          }
        }}
        className={cn("h-full bg-transparent text-center text-sm font-semibold tnum outline-none", size === "xs" ? "w-9" : "w-12")}
        data-testid={`qty-${id}`}
      />
      <button type="button" className={cn("grid h-full place-items-center rounded-lg hover:bg-sand disabled:opacity-40", w)} onClick={() => onChange(Math.min(999, qty + 1))} disabled={qty >= 999} aria-label="+1">
        <Plus className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

/** Lien « Transformer en demande de devis » : le formulaire de devis reprend les lignes du panier. */
export function CartToQuote({ className, primary = false }: { className?: string; primary?: boolean }) {
  const { locale } = useT();
  const c = commerceDict(locale);
  return (
    <div className={className}>
      <Link href="/devis?panier=1" data-testid="cart-quote" className={cn("btn w-full", primary ? "btn-primary" : "btn-ghost")}>
        <FileText className="size-4" aria-hidden /> {c.cart.toQuote}
      </Link>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{c.cart.toQuoteHelp}</p>
    </div>
  );
}
