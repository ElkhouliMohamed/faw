"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { FormGuard, track, useCart, useConsent, useShop, useT } from "@/components/providers";
import { DeliverySelector, Totals } from "@/components/cart-parts";
import { Steps } from "@/components/steps";
import { readAttribution } from "@/components/tracking";
import { createOrder, type OrderFormState } from "@/app/actions/order";
import { allowedPayments, cityOf, type PaymentMethod } from "@/lib/delivery";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

function Field({ name, label, error, className, children }: { name: string; label: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive" role="alert">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

const inputCls =
  "h-12 w-full rounded-lg border border-input bg-background px-3.5 text-[15px] outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive dark:bg-input/20";

export function CheckoutForm() {
  const { t, locale } = useT();
  const { ready, rows, lines, mode, ctx, coupon, cartId } = useCart();
  const { shipping } = useShop();
  const { consent } = useConsent();
  // Coordonnées du panier (relance) : seulement avec accord explicite, notice visible sous le téléphone.
  const saveContact = (form: HTMLFormElement | null) => {
    if (!form || consent !== "granted" || !cartId) return;
    const fd = new FormData(form);
    void fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: cartId, items: lines, name: fd.get("customerName"), phone: fd.get("phone"), email: fd.get("email") }), keepalive: true }).catch(() => {});
  };
  useEffect(() => {
    if (ready && rows.length) {
      track("checkout");
      const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
      window.dispatchEvent(new CustomEvent("faw:begin-checkout", { detail: { value: subtotal, quantity: rows.reduce((s, r) => s + r.qty, 0) } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const [state, action, pending] = useActionState<OrderFormState, FormData>(createOrder, null);
  const payments = allowedPayments(ctx);
  const [payment, setPayment] = useState<PaymentMethod>("virement");
  const [attr, setAttr] = useState("{}");
  useEffect(() => setAttr(readAttribution()), []);
  useEffect(() => {
    if (!payments.includes(payment)) setPayment("virement");
  }, [payments, payment]);
  const e = state?.errors ?? {};
  const cityDefault = mode === "retrait" ? "Casablanca" : cityOf(mode, shipping)?.name ?? "";
  const inv = (k: string) => (e[k] ? { "aria-invalid": true, "aria-describedby": `${k}-error` } : {});

  if (ready && rows.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6">
        <h1 className="text-3xl font-semibold">{t.checkout.title}</h1>
        <p className="mt-4 text-muted-foreground">{t.cart.empty}</p>
        <Link href="/produits" className="mt-6 inline-flex h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">{t.cart.continue}</Link>
      </div>
    );
  }

  return (
    <div className="shell pt-10 sm:pt-14">
      <Steps current={1} />
      <h1 className="mt-8 text-d1">{t.checkout.title}</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t.checkout.lead}</p>

      <form action={action} className="mt-8 grid gap-8 lg:grid-cols-12" noValidate data-testid="checkout-form">
        <input type="hidden" name="items" value={JSON.stringify(lines)} />
        <input type="hidden" name="deliveryMode" value={mode} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="attribution" value={attr} />
        <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
        <input type="hidden" name="cartId" value={cartId} />
        <FormGuard />

        <div className="space-y-8 lg:col-span-7">
          {(state?.message || Object.keys(e).length > 0) && (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{state?.message ?? t.checkout.errors}{e.items ? ` (${e.items})` : ""}{e.deliveryMode ? ` (${e.deliveryMode})` : ""}{e.coupon ? ` (${e.coupon})` : ""}</span>
            </div>
          )}

          <section className="rounded-lg border border-rule bg-card p-5 sm:p-8">
            <h2 className="text-base font-semibold">{t.checkout.contact}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field name="customerName" label={t.checkout.name} error={e.customerName} className="sm:col-span-2">
                <input id="customerName" name="customerName" autoComplete="name" required className={inputCls} {...inv("customerName")} />
              </Field>
              <Field name="phone" label={t.checkout.phone} error={e.phone}>
                <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required placeholder="06 00 00 00 00" dir="ltr" className={cn(inputCls, "text-start")} {...inv("phone")} onBlur={(ev) => saveContact(ev.currentTarget.form)} />
                {consent === "granted" && <p className="mt-1 text-xs text-muted-foreground" data-testid="cart-save-note">{t.mod.cartSaveNote}</p>}
              </Field>
              <Field name="email" label={t.checkout.email} error={e.email}>
                <input id="email" name="email" type="email" autoComplete="email" dir="ltr" className={cn(inputCls, "text-start")} {...inv("email")} />
              </Field>
              <Field name="city" label={t.checkout.city} error={e.city}>
                <input key={cityDefault} id="city" name="city" autoComplete="address-level2" required defaultValue={cityDefault} className={inputCls} {...inv("city")} />
              </Field>
              <Field name="address" label={mode === "retrait" ? t.checkout.addressPickup : t.checkout.address} error={e.address}>
                <input id="address" name="address" autoComplete="street-address" required={mode !== "retrait"} className={inputCls} {...inv("address")} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-rule bg-card p-5 sm:p-8">
            <h2 className="text-base font-semibold">{t.checkout.pro}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field name="company" label={t.checkout.company} error={e.company}>
                <input id="company" name="company" autoComplete="organization" className={inputCls} {...inv("company")} />
              </Field>
              <Field name="ice" label={t.checkout.ice} error={e.ice}>
                <input id="ice" name="ice" inputMode="numeric" placeholder="15 chiffres" dir="ltr" className={cn(inputCls, "text-start font-mono")} {...inv("ice")} />
              </Field>
            </div>
          </section>

          <section className="rounded-lg border border-rule bg-card p-5 sm:p-8">
            <DeliverySelector />
          </section>

          <section className="rounded-lg border border-rule bg-card p-5 sm:p-8">
            <fieldset>
              <legend className="text-base font-semibold">{t.checkout.payment}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {payments.map((m) => (
                  <label
                    key={m}
                    data-testid={`payment-${m}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                      payment === m ? "border-copper bg-sand" : "border-rule hover:border-copper/60",
                    )}
                  >
                    <input type="radio" name="paymentMethod" value={m} checked={payment === m} onChange={() => setPayment(m)} className="mt-1 accent-[var(--copper)]" />
                    <span>
                      <span className="block text-sm font-semibold">{t.payment[m]}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{t.paymentHelp[m]}</span>
                    </span>
                  </label>
                ))}
              </div>
              {e.paymentMethod && <p className="mt-2 text-xs font-medium text-destructive" role="alert">{e.paymentMethod}</p>}
            </fieldset>
          </section>

          <section className="rounded-lg border border-rule bg-card p-5 sm:p-8">
            <Field name="notes" label={t.checkout.notes} error={e.notes}>
              <textarea id="notes" name="notes" rows={4} placeholder={t.checkout.notesPh} className={cn(inputCls, "h-auto py-2.5")} />
            </Field>
          </section>
        </div>

        <aside className="lg:col-span-5">
          <div className="sticky top-24 rounded-lg bg-sand p-6 sm:p-8">
            <h2 className="text-lg font-semibold">{t.checkout.summary}</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {rows.map((r) => (
                <li key={r.product.id} className="flex justify-between gap-3">
                  <span className="min-w-0" lang="fr" dir="auto"><span className="font-mono text-xs text-muted-foreground">{r.qty}×</span> {r.product.title}</span>
                  <span className="shrink-0" dir="ltr">{formatDH(r.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <Totals className="mt-4 border-t border-border pt-4" />
            <button
              type="submit"
              disabled={pending || !ready}
              data-testid="submit-order"
              className="mt-6 btn btn-primary w-full disabled:opacity-60"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
              {pending ? t.checkout.sending : t.checkout.submit}
            </button>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t.cart.note}</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.checkout.consent}</p>
          </div>
        </aside>
      </form>
    </div>
  );
}
