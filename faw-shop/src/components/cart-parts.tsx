"use client";

import { useState, useTransition } from "react";
import { Info, Store, Tag, Truck, X } from "lucide-react";
import { useCart, useShop, useT } from "./providers";
import { availableModes, cityOf, type DeliveryMode } from "@/lib/delivery";
import { checkCoupon } from "@/app/actions/coupon";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DeliverySelector() {
  const { t } = useT();
  const { ctx, mode, setMode, notes, fee } = useCart();
  const { shipping } = useShop();
  const modes = availableModes(ctx, shipping);
  const price = (m: DeliveryMode) => {
    const c = cityOf(m, shipping);
    if (c) return m === mode && fee > 0 ? formatDH(fee) : c.fee == null ? t.cart.onQuote : formatDH(c.fee);
    return m === "retrait" ? t.cart.free : m === "transporteur" ? t.cart.onReception : t.cart.onQuote;
  };
  const label = (m: DeliveryMode) => {
    const c = cityOf(m, shipping);
    return c && !(m in t.delivery) ? `${t.mod.deliverTo} ${c.name}` : t.delivery[m];
  };

  return (
    <fieldset>
      <legend className="text-base font-semibold">{t.cart.delivery}</legend>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {modes.map((m) => (
          <label
            key={m}
            data-testid={`delivery-${m}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
              mode === m ? "border-copper bg-sand" : "border-rule bg-card hover:border-copper/60",
            )}
          >
            <input type="radio" name="deliveryModeUi" value={m} checked={mode === m} onChange={() => setMode(m)} className="mt-1 accent-[var(--copper)]" />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                {m === "retrait" ? <Store className="size-4 text-copper" /> : <Truck className="size-4 text-copper" />}
                {label(m)}
              </span>
              <span className="mt-0.5 block text-xs tnum text-muted-foreground" dir="auto">{price(m)}</span>
              {cityOf(m, shipping)?.delayText ? <span className="mt-0.5 block text-xs text-muted-foreground" lang="fr">{cityOf(m, shipping)!.delayText}</span> : null}
            </span>
          </label>
        ))}
      </div>
      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground" data-testid="delivery-notes">
          {notes.map((n) => (
            <li key={n} className="flex gap-1.5"><Info className="mt-px size-3.5 shrink-0" />{t.deliveryNotes[n]}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );
}

export function Totals({ className }: { className?: string }) {
  const { t } = useT();
  const { subtotal, fee, mode, ctx, coupon, discount, total } = useCart();
  const feeLabel =
    fee > 0 ? formatDH(fee) : mode === "retrait" ? t.cart.free : mode === "autre" ? t.cart.onQuote : mode === "transporteur" ? t.cart.onReception : t.cart.onQuote;
  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{t.cart.subtotal}</dt>
        <dd dir="ltr" data-testid="subtotal">{formatDH(subtotal)}</dd>
      </div>
      <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{t.cart.deliveryFee}</dt>
        <dd dir="auto" data-testid="delivery-fee">{feeLabel}</dd>
      </div>
      {coupon && discount > 0 && (
        <div className="flex justify-between gap-4" data-testid="coupon-line">
          <dt className="text-muted-foreground">{t.mod.couponLine} <span className="font-mono text-xs">{coupon.code}</span></dt>
          <dd dir="ltr" className="tnum">−{formatDH(discount)}</dd>
        </div>
      )}
      {ctx.hasKit && !ctx.kitOnly && (
        <div className="flex justify-between gap-4 text-xs text-muted-foreground">
          <dt>Kit G-BAT 300</dt>
          <dd>{t.cart.onReception}</dd>
        </div>
      )}
      <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
        <dt className="font-semibold">{t.cart.total}</dt>
        <dd className="text-d3 font-semibold tnum text-price" dir="ltr" data-testid="total">{formatDH(total)}</dd>
      </div>
    </dl>
  );
}

/** Saisie d'un code promo : vérifié côté serveur, recalculé à l'envoi de la commande. */
export function CouponField() {
  const { t } = useT();
  const { coupon, setCoupon, subtotal } = useCart();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (coupon)
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-rule bg-sand px-3 py-2 text-sm" data-testid="coupon-applied">
        <span className="flex items-center gap-1.5"><Tag className="size-4 text-copper" />{t.mod.coupon} <b className="font-mono">{coupon.code}</b></span>
        <button type="button" onClick={() => setCoupon(null)} className="inline-flex items-center gap-1 text-xs underline" data-testid="coupon-remove"><X className="size-3.5" />{t.mod.couponRemove}</button>
      </div>
    );
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await checkCoupon(code, subtotal);
          if (r.ok) {
            setCoupon(r.coupon);
            setMsg(null);
            setCode("");
          } else setMsg(r.message);
        });
      }}
    >
      <label htmlFor="coupon-code" className="text-xs text-muted-foreground">{t.mod.coupon}</label>
      <div className="flex gap-2">
        <input id="coupon-code" data-testid="coupon-input" value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} autoComplete="off" className="h-10 min-w-0 flex-1 rounded-[2px] border border-input bg-background px-3 text-sm uppercase outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
        <button type="submit" disabled={pending || !code.trim()} className="btn btn-ghost h-10 px-4 text-sm" data-testid="coupon-apply">{t.mod.couponApply}</button>
      </div>
      {msg && <p className="text-xs text-destructive" role="alert" data-testid="coupon-error">{msg}</p>}
    </form>
  );
}
