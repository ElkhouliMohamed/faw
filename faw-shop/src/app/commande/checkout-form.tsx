"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import {
  AlertCircle, ArrowLeft, Building2, ChevronDown, CreditCard, Handshake, Headset, Landmark, Loader2, Lock, MapPin, MessageSquarePlus,
  Package, ShieldCheck, ShoppingBag, Store, Truck, User, X,
} from "lucide-react";
import { FormGuard, track, useCart, useConsent, useFormToken, useShop, useT } from "@/components/providers";
import { CouponField } from "@/components/cart-parts";
import { CartToQuote, ServerTotals, useCartPreview } from "@/components/cart-summary";
import { ProductImage } from "@/components/product-image";
import { readAttribution } from "@/components/tracking";
import { createOrder, type OrderFormState } from "@/app/actions/order";
import { availableModes, cityOf, computeDelivery } from "@/lib/delivery";
import { commerceDict } from "@/lib/commerce-dict";
import { forgetCheckoutMemory, loadCheckoutMemory, stashCheckoutMemory } from "@/lib/checkout-memory";
import type { PaymentKey } from "@/lib/commerce";
import { formatMAD } from "@/lib/money";
import { cn } from "@/lib/utils";

type Vals = { clientType: "particulier" | "entreprise"; name: string; phone: string; email: string; company: string; ice: string; city: string; address: string; note: string };
const EMPTY: Vals = { clientType: "particulier", name: "", phone: "", email: "", company: "", ice: "", city: "", address: "", note: "" };
type Errs = Partial<Record<keyof Vals | "cgv" | "paymentMethod", string>>;

const MIN_FILL_MS = 3300;
const PHONE_RE = /^(\+212|00212|0)?[5-7]\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PAY_ICON: Record<PaymentKey, typeof Landmark> = { virement: Landmark, reception: Handshake, carte: CreditCard };
/** Ordre des champs pour placer le focus sur la première erreur. */
const ORDER = ["name", "phone", "email", "company", "ice", "city", "address", "paymentMethod", "cgv"] as const;

const inputCls =
  "h-12 w-full rounded-xl border border-input bg-card px-4 text-[15px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 hover:border-foreground/30 focus-visible:border-flame focus-visible:ring-3 focus-visible:ring-flame/25 aria-invalid:border-destructive aria-invalid:ring-destructive/15";

function Field({ id, label, hint, error, className, children }: { id: string; label: string; hint?: string; error?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-destructive" role="alert">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({ n, title, icon: Icon, children, aside }: { n: number; title: string; icon: typeof User; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-card p-5 shadow-soft sm:p-7" aria-labelledby={`step-${n}`}>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-flame text-sm font-bold text-ink tnum" aria-hidden>{n}</span>
        <h2 id={`step-${n}`} className="flex-1 text-lg font-bold text-ink dark:text-foreground">
          <span className="sr-only">{n}. </span>{title}
        </h2>
        {aside ?? <Icon className="size-5 text-copper" aria-hidden />}
      </div>
      {children}
    </section>
  );
}

export function CheckoutForm({ pickupAddress }: { pickupAddress: string }) {
  const { t, locale } = useT();
  const c = commerceDict(locale);
  const { ready, rows, lines, mode, setMode, ctx, coupon, cartId } = useCart();
  const { shipping } = useShop();
  const { consent } = useConsent();
  const preview = useCartPreview();
  const data = preview.data;
  const [state, action, pending] = useActionState<OrderFormState, FormData>(createOrder, null);

  const [vals, setVals] = useState<Vals>(EMPTY);
  const [remembered, setRemembered] = useState(false);
  const [errs, setErrs] = useState<Errs>({});
  const [cgv, setCgv] = useState(false);
  const [payment, setPayment] = useState<PaymentKey | "">("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [attr, setAttr] = useState("{}");
  const banner = useRef<HTMLDivElement>(null);
  // Anti-robot : le serveur refuse un jeton émis il y a moins de 3 s. Un client pressé (coordonnées pré-remplies) n'a pas
  // d'erreur : l'envoi part automatiquement à la fin du délai, bouton en attente. Le délai court depuis la réception du
  // jeton courant (il peut être renouvelé après l'affichage), jamais depuis l'horloge du serveur.
  const token = useFormToken();
  const tokenSeenAt = useRef(0);
  const [waiting, setWaiting] = useState(false);
  const waitingRef = useRef(false);
  useEffect(() => {
    tokenSeenAt.current = Date.now();
  }, [token]);

  // Pré-remplissage : coordonnées de la dernière commande (navigateur du client uniquement).
  useEffect(() => {
    setAttr(readAttribution());
    const m = loadCheckoutMemory();
    if (!m) return;
    setVals((v) => ({ ...v, clientType: m.clientType, name: m.name, phone: m.phone, email: m.email, company: m.company, ice: m.ice, city: m.city, address: m.address }));
    setRemembered(true);
  }, []);
  // Ville mémorisée : présélectionnée si elle est proposée pour ce panier.
  const restored = useRef(false);
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const m = loadCheckoutMemory();
    if (m?.mode && availableModes(ctx, shipping).includes(m.mode)) setMode(m.mode);
  }, [ready, ctx, shipping, setMode]);

  // Mesure : début de commande (dataLayer / Pixel après consentement, via l'événement faw:begin-checkout).
  useEffect(() => {
    if (ready && rows.length) {
      track("checkout");
      const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
      window.dispatchEvent(new CustomEvent("faw:begin-checkout", { detail: { value: subtotal, quantity: rows.reduce((s, r) => s + r.qty, 0) } }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // Paiement : premier mode disponible présélectionné (liste fournie par Laravel : CMI seulement s'il est activé).
  const payments = data?.payments ?? null;
  useEffect(() => {
    if (!payments) return;
    const ok = payments.filter((p) => p.available).map((p) => p.key);
    if (!payment || !ok.includes(payment)) setPayment(ok[0] ?? "");
  }, [payments, payment]);

  // Erreurs renvoyées par le serveur : affichées sous les champs concernés.
  useEffect(() => {
    if (!state) return;
    const e = state.errors ?? {};
    setErrs(e as Errs);
    requestAnimationFrame(() => banner.current?.scrollIntoView({ block: "center", behavior: "smooth" }));
  }, [state]);

  const modes = availableModes(ctx, shipping);
  const city = cityOf(mode, shipping);
  const pickup = mode === "retrait";
  const needCity = !pickup && !city;
  const blocked = rows.some((r) => r.product.quoteOnly) || !!data?.quoteRequired;
  const set = (k: keyof Vals) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value;
    setVals((s) => ({ ...s, [k]: v }));
    if (errs[k]) setErrs((s) => ({ ...s, [k]: undefined }));
  };
  const aria = (k: keyof Errs, hint = false) =>
    errs[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : hint ? { "aria-describedby": `${k}-hint` } : {};

  const validate = (): Errs => {
    const e: Errs = {};
    const phone = vals.phone.replace(/[\s.()-]/g, "");
    if (vals.name.trim().length < 2) e.name = c.co.err.name;
    if (!PHONE_RE.test(phone)) e.phone = c.co.err.phone;
    if (!EMAIL_RE.test(vals.email.trim())) e.email = c.co.err.email;
    if (vals.clientType === "entreprise" && vals.company.trim().length < 2) e.company = c.co.err.company;
    if (vals.clientType === "entreprise" && vals.ice.trim() && !/^\d{15}$/.test(vals.ice.replace(/\s/g, ""))) e.ice = c.co.err.ice;
    if (needCity && vals.city.trim().length < 2) e.city = c.co.err.city;
    if (!pickup && vals.address.trim().length < 5) e.address = c.co.err.address;
    if (!payment) e.paymentMethod = c.co.err.payment;
    if (!cgv) e.cgv = c.co.err.cgv;
    return e;
  };

  const onSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    if (waitingRef.current) {
      ev.preventDefault();
      return;
    }
    const e = validate();
    if (Object.keys(e).length) {
      ev.preventDefault();
      setErrs(e);
      const first = ORDER.find((k) => e[k]);
      const el = first ? (document.getElementById(first === "paymentMethod" ? `pay-${payments?.find((p) => p.available)?.key ?? ""}` : first) as HTMLElement | null) : null;
      el?.focus();
      return;
    }
    const wait = MIN_FILL_MS - (Date.now() - tokenSeenAt.current);
    if (wait > 0) {
      ev.preventDefault();
      const form = ev.currentTarget;
      waitingRef.current = true;
      setWaiting(true);
      setTimeout(() => {
        waitingRef.current = false;
        setWaiting(false);
        form.requestSubmit();
      }, wait);
      return;
    }
    stashCheckoutMemory({ ...vals, mode });
  };

  // Relance de panier : coordonnées transmises seulement avec accord explicite (mention sous le téléphone).
  const saveContact = () => {
    if (consent !== "granted" || !cartId) return;
    void fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: cartId, items: lines, name: vals.name, phone: vals.phone, email: vals.email }), keepalive: true }).catch(() => {});
  };

  const forget = () => {
    forgetCheckoutMemory();
    setVals(EMPTY);
    setRemembered(false);
    document.getElementById("name")?.focus();
  };

  const modeInfo = (m: string) => {
    const ct = cityOf(m, shipping);
    const selectedFee = m === mode && data ? data.shipping.fee : null;
    if (m === "retrait") return { icon: Store, label: c.co.pickup, price: c.cart.free, help: "" };
    if (ct) {
      const d = computeDelivery(m, ctx, shipping);
      const price = selectedFee != null && !data?.shipping.toConfirm ? (selectedFee > 0 ? formatMAD(selectedFee) : c.cart.free) : d.notes.includes("cityDevis") ? c.cart.toConfirm : d.fee > 0 ? formatMAD(d.fee) : c.cart.toConfirm;
      return { icon: Truck, label: c.co.deliverCity(ct.name), price, help: ct.delayText };
    }
    if (m === "transporteur") return { icon: Package, label: c.co.carrier, price: c.cart.toConfirm, help: c.co.carrierHelp };
    return { icon: MapPin, label: c.co.otherCity, price: c.cart.toConfirm, help: c.co.otherCityHelp };
  };

  if (ready && rows.length === 0) {
    return (
      <div className="-mb-20 bg-paper pb-20 lg:-mb-28 lg:pb-28">
        <div className="shell max-w-xl pt-16 text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-sand text-copper" aria-hidden>
            <ShoppingBag className="size-9" strokeWidth={1.5} />
          </span>
          <h1 className="mt-5 text-2xl font-bold">{c.co.title}</h1>
          <p className="mt-2 text-muted-foreground">{c.cart.empty}</p>
          <Link href="/produits" className="btn btn-primary mt-6 rounded-xl">{c.drawer.browse}</Link>
        </div>
      </div>
    );
  }

  const total = data && !data.quoteRequired ? data.totalTtc : null;
  const serverMessage = state?.message;
  const hasErrs = Object.values(errs).some(Boolean);

  return (
    <div className="-mb-20 bg-paper pb-20 lg:-mb-28 lg:pb-28">
      <div className="shell max-w-[1200px] pt-6 sm:pt-10">
        <Link href="/panier" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-copper">
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden /> {c.co.back}
        </Link>
        <h1 className="mt-1 text-[clamp(1.75rem,1.4rem+1.4vw,2.5rem)] leading-tight font-bold text-ink dark:text-foreground">{c.co.title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{c.co.lead}</p>

        <div className="mt-6 grid items-start gap-6 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_25rem] lg:gap-10">
          {/* Récapitulatif : en haut et repliable sur mobile, colonne collante à droite sur ordinateur */}
          <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1" aria-labelledby="summary-title" data-testid="checkout-summary">
            <div className="overflow-hidden rounded-2xl bg-card shadow-soft">
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 px-5 text-start lg:hidden"
                aria-expanded={summaryOpen}
                aria-controls="summary-body"
                onClick={() => setSummaryOpen((o) => !o)}
                data-testid="summary-toggle"
              >
                <ShoppingBag className="size-5 text-copper" aria-hidden />
                <span className="flex-1 text-sm font-semibold">{summaryOpen ? c.co.hideSummary : c.co.showSummary}</span>
                <span className="font-bold tnum" dir="ltr">{total != null ? formatMAD(total) : "…"}</span>
                <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", summaryOpen && "rotate-180")} aria-hidden />
              </button>
              <div id="summary-body" className={cn("border-t border-rule p-5 sm:p-6 lg:block lg:border-0", !summaryOpen && "hidden")}>
                <h2 id="summary-title" className="text-lg font-bold">{c.co.summary}</h2>
                <ul className="mt-4 space-y-3" data-testid="summary-lines">
                  {rows.map((r) => {
                    const line = data?.items.find((i) => i.id === r.product.id);
                    const lt = r.product.quoteOnly ? null : line?.totalTtc ?? null;
                    return (
                      <li key={r.product.id} className="flex items-center gap-3">
                        <span className="relative size-14 shrink-0 rounded-xl bg-sand">
                          <span className="absolute inset-0 overflow-hidden rounded-xl">
                            <ProductImage src={r.product.image} alt="" sizes="56px" fit="cover" placeholderLabel="" />
                          </span>
                          <span className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-bark px-1 text-[0.6875rem] font-bold text-bark-fg tnum">{r.qty}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm font-medium leading-snug" lang="fr" dir="auto">{r.product.title}</span>
                          {r.product.variantLabel && <span className="block text-xs text-muted-foreground" lang="fr" dir="auto">{r.product.variantLabel}</span>}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tnum" dir={lt != null ? "ltr" : undefined}>{lt != null ? formatMAD(lt) : r.product.quoteOnly ? c.price.onQuote : ""}</span>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-5 border-t border-rule pt-4"><CouponField /></div>
                <ServerTotals preview={preview} className="mt-4 border-t border-rule pt-4" />
              </div>
            </div>
          </aside>

          <form action={action} onSubmit={onSubmit} noValidate className="space-y-5 lg:col-start-1 lg:row-start-1" data-testid="checkout-form">
            <input type="hidden" name="items" value={JSON.stringify(lines)} />
            <input type="hidden" name="deliveryMode" value={mode} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="attribution" value={attr} />
            <input type="hidden" name="coupon" value={coupon?.code ?? ""} />
            <input type="hidden" name="cartId" value={cartId} />
            {!needCity && <input type="hidden" name="city" value={city ? city.name : vals.city.trim() || "Casablanca"} />}
            <FormGuard />

            {(serverMessage || hasErrs) && (
              <div ref={banner} role="alert" className="flex items-start gap-2.5 rounded-2xl border border-destructive/30 bg-[color-mix(in_oklab,var(--destructive)_8%,var(--card))] p-4 text-sm text-destructive" data-testid="checkout-error">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{serverMessage ?? c.co.fix}</span>
              </div>
            )}

            <Section
              n={1}
              title={c.co.step1}
              icon={User}
              aside={remembered ? (
                <button type="button" onClick={forget} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-copper hover:underline" data-testid="forget-me">
                  <X className="size-3.5" aria-hidden /> {c.co.forget}
                </button>
              ) : undefined}
            >
              {remembered && <p className="-mt-2 mb-4 text-xs text-muted-foreground" data-testid="remembered">{c.co.remembered}</p>}
              <fieldset>
                <legend className="mb-2 text-sm font-semibold">{c.co.clientType}</legend>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-sand p-1" data-testid="client-type">
                  {(["particulier", "entreprise"] as const).map((k) => (
                    <label
                      key={k}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                        vals.clientType === k ? "bg-card text-ink shadow-sm dark:text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <input type="radio" name="clientType" value={k} checked={vals.clientType === k} onChange={() => setVals((s) => ({ ...s, clientType: k }))} className="sr-only" />
                      {k === "particulier" ? <User className="size-4" aria-hidden /> : <Building2 className="size-4" aria-hidden />}
                      {k === "particulier" ? c.co.individual : c.co.company}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field id="name" label={c.co.name} error={errs.name} className="sm:col-span-2">
                  <input id="name" name="name" autoComplete="name" required maxLength={80} value={vals.name} onChange={set("name")} className={inputCls} {...aria("name")} />
                </Field>
                <Field id="phone" label={c.co.phone} hint={c.co.phoneHint} error={errs.phone}>
                  <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={20} placeholder="06 12 34 56 78" dir="ltr" value={vals.phone} onChange={set("phone")} onBlur={saveContact} className={cn(inputCls, "text-start tnum")} {...aria("phone", true)} />
                  {consent === "granted" && <p className="mt-1 text-xs text-muted-foreground" data-testid="cart-save-note">{t.mod.cartSaveNote}</p>}
                </Field>
                <Field id="email" label={c.co.email} hint={c.co.emailHint} error={errs.email}>
                  <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required maxLength={120} dir="ltr" value={vals.email} onChange={set("email")} className={cn(inputCls, "text-start")} {...aria("email", true)} />
                </Field>
                {vals.clientType === "entreprise" && (
                  <>
                    <Field id="company" label={c.co.companyName} error={errs.company}>
                      <input id="company" name="company" autoComplete="organization" required maxLength={120} value={vals.company} onChange={set("company")} className={inputCls} {...aria("company")} />
                    </Field>
                    <Field id="ice" label={c.co.ice} hint={c.co.iceHint} error={errs.ice}>
                      <input id="ice" name="ice" inputMode="numeric" autoComplete="off" maxLength={18} dir="ltr" value={vals.ice} onChange={set("ice")} className={cn(inputCls, "text-start tnum")} {...aria("ice", true)} />
                    </Field>
                  </>
                )}
              </div>
            </Section>

            <Section n={2} title={c.co.step2} icon={Truck}>
              <fieldset>
                <legend className="sr-only">{c.co.step2}</legend>
                <div className="grid gap-2.5 sm:grid-cols-2" data-testid="delivery-modes">
                  {modes.map((m) => {
                    const info = modeInfo(m);
                    const Icon = info.icon;
                    const on = mode === m;
                    return (
                      <label
                        key={m}
                        data-testid={`delivery-${m}`}
                        className={cn(
                          "relative flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                          on ? "border-flame bg-[color-mix(in_oklab,var(--flame)_8%,var(--card))] ring-1 ring-flame" : "border-rule hover:border-flame/60",
                        )}
                      >
                        <input type="radio" name="deliveryModeUi" value={m} checked={on} onChange={() => setMode(m)} className="sr-only" />
                        <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-flame text-ink" : "bg-sand text-copper")} aria-hidden>
                          <Icon className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-semibold leading-snug">{info.label}</span>
                            <span className="shrink-0 text-sm font-bold tnum" dir="auto">{info.price}</span>
                          </span>
                          {info.help && <span className="mt-0.5 block text-xs text-muted-foreground">{info.help}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {pickup ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-sand p-4 text-sm" data-testid="pickup-address">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden />
                  <span>
                    <span className="block font-semibold">{c.co.pickupAt}</span>
                    <span className="text-muted-foreground" lang="fr" dir="auto">{pickupAddress}</span>
                  </span>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {needCity && (
                    <Field id="city" label={c.co.city} error={errs.city}>
                      <input id="city" name="city" autoComplete="address-level2" required maxLength={60} value={vals.city} onChange={set("city")} className={inputCls} {...aria("city")} />
                    </Field>
                  )}
                  <Field id="address" label={c.co.address} error={errs.address} className={needCity ? undefined : "sm:col-span-2"}>
                    <input id="address" name="address" autoComplete="street-address" required maxLength={300} placeholder={c.co.addressPh} value={vals.address} onChange={set("address")} className={inputCls} {...aria("address")} />
                  </Field>
                </div>
              )}

              <div className="mt-4">
                {noteOpen || vals.note ? (
                  <Field id="note" label={c.co.noteLabel}>
                    <textarea id="note" name="note" rows={3} maxLength={600} value={vals.note} onChange={set("note")} className={cn(inputCls, "h-auto py-3")} />
                  </Field>
                ) : (
                  <button type="button" onClick={() => setNoteOpen(true)} className="inline-flex min-h-11 items-center gap-2 text-start text-sm font-semibold text-copper hover:underline" data-testid="add-note">
                    <MessageSquarePlus className="size-4" aria-hidden /> {c.co.note}
                  </button>
                )}
              </div>
            </Section>

            <Section n={3} title={c.co.step3} icon={Lock}>
              <fieldset aria-describedby={errs.paymentMethod ? "paymentMethod-error" : undefined}>
                <legend className="sr-only">{c.co.step3}</legend>
                {!payments ? (
                  <div className="grid gap-2.5" aria-busy="true" aria-label={c.co.payLoading}>
                    {[0, 1].map((i) => <div key={i} className="h-[4.75rem] animate-pulse rounded-xl bg-sand motion-reduce:animate-none" />)}
                  </div>
                ) : payments.length === 0 ? (
                  <p className="rounded-xl bg-sand p-4 text-sm">{c.co.noPayment}</p>
                ) : (
                  <div className="grid gap-2.5" data-testid="payment-methods">
                    {payments.map((p) => {
                      const Icon = PAY_ICON[p.key];
                      const on = payment === p.key;
                      return (
                        <label
                          key={p.key}
                          data-testid={`payment-${p.key}`}
                          className={cn(
                            "flex items-center gap-3 rounded-xl border p-4 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/40",
                            !p.available ? "cursor-not-allowed border-rule opacity-60" : on ? "cursor-pointer border-flame bg-[color-mix(in_oklab,var(--flame)_8%,var(--card))] ring-1 ring-flame" : "cursor-pointer border-rule hover:border-flame/60",
                          )}
                        >
                          <input
                            id={`pay-${p.key}`}
                            type="radio"
                            name="paymentMethod"
                            value={p.key}
                            checked={on}
                            disabled={!p.available}
                            onChange={() => {
                              setPayment(p.key);
                              setErrs((s) => ({ ...s, paymentMethod: undefined }));
                            }}
                            className="size-4 shrink-0 accent-[var(--flame)]"
                          />
                          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-flame text-ink" : "bg-sand text-copper")} aria-hidden>
                            <Icon className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold">{c.pay[p.key]}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">{!p.available && p.reason ? c.pay.reasons[p.reason] ?? p.reason : c.pay.help[p.key]}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {errs.paymentMethod && (
                  <p id="paymentMethod-error" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
                    <AlertCircle className="size-3.5" aria-hidden /> {errs.paymentMethod}
                  </p>
                )}
              </fieldset>
            </Section>

            <div className="rounded-2xl bg-card p-5 shadow-soft sm:p-7">
              {blocked ? (
                <>
                  <p className="mb-4 flex gap-2 rounded-xl bg-sand p-4 text-sm" role="status">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-copper" aria-hidden /> {c.cart.quoteNeeded}
                  </p>
                  <CartToQuote primary />
                </>
              ) : (
                <>
                  <label className="flex cursor-pointer items-start gap-3 text-sm" htmlFor="cgv">
                    <input
                      id="cgv"
                      type="checkbox"
                      name="cgv"
                      value="1"
                      checked={cgv}
                      onChange={(e) => {
                        setCgv(e.target.checked);
                        setErrs((s) => ({ ...s, cgv: undefined }));
                      }}
                      className="mt-0.5 size-5 shrink-0 rounded accent-[var(--flame)]"
                      {...(errs.cgv ? { "aria-invalid": true, "aria-describedby": "cgv-error" } : {})}
                      data-testid="cgv"
                    />
                    <span>
                      {c.co.cgv}{" "}
                      <Link href="/livraison" target="_blank" className="font-semibold text-copper underline underline-offset-4">{c.co.cgvLink}</Link>
                    </span>
                  </label>
                  {errs.cgv && (
                    <p id="cgv-error" className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive" role="alert">
                      <AlertCircle className="size-3.5" aria-hidden /> {errs.cgv}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={pending || waiting || !ready}
                    aria-busy={pending || waiting}
                    data-testid="submit-order"
                    className="btn btn-primary mt-5 h-auto min-h-14 w-full flex-wrap gap-x-2 gap-y-1 rounded-xl py-3 text-base shadow-soft disabled:cursor-wait disabled:opacity-80"
                  >
                    {pending || waiting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Lock className="size-5" aria-hidden />}
                    <span>{pending || waiting ? c.co.sending : c.co.confirm}</span>
                    {!pending && !waiting && total != null && (
                      <>
                        <span className="hidden sm:inline" aria-hidden>·</span>
                        <bdi className="tnum" dir="ltr" data-testid="submit-total">{formatMAD(total)}</bdi>
                      </>
                    )}
                  </button>
                </>
              )}
              <ul className="mt-5 grid gap-3 text-xs text-muted-foreground sm:grid-cols-3" data-testid="trust-strip">
                <li className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-copper" aria-hidden />{c.co.trustSecure}</li>
                <li className="flex items-center gap-2"><Truck className="size-4 shrink-0 text-copper" aria-hidden />{c.co.trustDelivery}</li>
                <li className="flex items-center gap-2"><Headset className="size-4 shrink-0 text-copper" aria-hidden />{c.co.trustSupport}</li>
              </ul>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
