"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, CheckCircle2, FileText, Loader2, Minus, Plus, Trash2, User } from "lucide-react";
import { FormGuard, useCart, useShop, useCatalog, useT } from "@/components/providers";
import { WhatsAppIcon } from "@/components/icons";
import { readAttribution } from "@/components/tracking";
import { createQuote, type QuoteFormState } from "@/app/actions/quote";
import { formatDH } from "@/lib/format";
import { CATEGORIES, type PublicProduct } from "@/lib/products";
import { cn } from "@/lib/utils";

const inputCls =
  "h-12 w-full rounded-lg border border-input bg-background px-3.5 text-[15px] outline-none transition placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive dark:bg-input/20";
const CITIES = ["Casablanca", "Rabat", "Mohammedia", "Berrechid", "Settat", "El Jadida", "Kénitra", "Salé", "Témara", "Marrakech", "Fès", "Meknès", "Tanger", "Agadir", "Oujda", "Tétouan", "Béni Mellal", "Nador", "Safi", "Khouribga"];
const TIER_IDS = ["CF-EI60-80", "CF-EI60-90", "CF-EI60-100"];

type Row = { key: number; id: string; qty: number };

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={`${id}-error`} className="mt-1 flex items-center gap-1 text-xs font-medium text-destructive" role="alert">
      <AlertCircle className="size-3.5" aria-hidden /> {msg}
    </p>
  );
}

export function estimate(rows: Row[], byId: Map<string, PublicProduct>) {
  const tierQty = rows.filter((r) => TIER_IDS.includes(r.id)).reduce((s, r) => s + r.qty, 0);
  let total = 0;
  let tier = false;
  for (const r of rows) {
    const p = byId.get(r.id);
    if (!p) continue;
    const t = TIER_IDS.includes(r.id) && tierQty >= 4;
    tier ||= t;
    const unit = p.price ?? 0;
    total += (t ? Math.min(2000, unit) : unit) * r.qty;
  }
  return { total, tier };
}

export function QuoteForm({ initialRef, initialQty, initialCategory, fromCart, embedded = false }: { initialRef?: string; initialQty: number; initialCategory?: string; fromCart: boolean; embedded?: boolean }) {
  const { locale } = useT();
  const catalog = useCatalog();
  const cart = useCart();
  const shop = useShop();
  const showPrices = shop.showPrices;
  // Packs proposés aussi en devis (dépliés côté serveur ; prix pack revu par l'équipe).
  const byId = useMemo(() => new Map([...catalog, ...shop.packs.map((b) => b.product)].map((p) => [p.id, p])), [catalog, shop.packs]);
  const [state, action, pending] = useActionState<QuoteFormState, FormData>(createQuote, null);
  const [type, setType] = useState<"particulier" | "entreprise">("particulier");
  const [proOpen, setProOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => (initialRef && byId.has(initialRef) ? [{ key: 1, id: initialRef, qty: initialQty }] : []));
  const [city, setCity] = useState("");
  const [pickup, setPickup] = useState(false);
  const [attr, setAttr] = useState("{}");
  const [nextKey, setNextKey] = useState(100);
  useEffect(() => setAttr(readAttribution()), []);

  // Pré-remplissage depuis le panier (suivi tant que le formulaire est intégré à la demande).
  const [cartDone, setCartDone] = useState(false);
  useEffect(() => {
    if (!cart.ready) return;
    if (embedded || fromCart) {
      setCartDone(true);
      if (cart.lines.length) {
        setRows(cart.lines.filter((l) => byId.has(l.id)).map((l, i) => ({ key: i + 10, id: l.id, qty: l.qty })));
      }
      return;
    }
    if (cartDone) return;
    setCartDone(true);
    if (rows.length === 0 && cart.lines.length && !initialRef) {
      setRows(cart.lines.filter((l) => byId.has(l.id)).map((l, i) => ({ key: i + 10, id: l.id, qty: l.qty })));
    } else if (rows.length === 0) {
      const first = catalog.find((p) => (initialCategory ? p.cat === initialCategory : true) && p.orderable) ?? catalog[0];
      if (first) setRows([{ key: 1, id: first.id, qty: 1 }]);
    }
  }, [cart.ready, cart.lines, cartDone, fromCart, embedded, initialRef, initialCategory, rows.length, byId, catalog]);

  useEffect(() => {
    if (type === "entreprise") setProOpen(true);
  }, [type]);

  const e = state && !state.refused ? (state.errors ?? {}) : {};
  useEffect(() => {
    if (e.company || e.ice) setProOpen(true);
  }, [e.company, e.ice]);
  const inv = (k: string) => (e[k] ? { "aria-invalid": true as const, "aria-describedby": `${k}-error` } : {});
  const { total, tier } = estimate(rows, byId);
  const hasKit = rows.some((r) => r.id.startsWith("AUTO-GBAT300"));
  const nCity = city.trim().toLowerCase();
  const norm = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
  const cityHit = shop.shipping.cities.find((c) => c.available && c.fee != null && c.fee > 0 && (norm(c.name) === norm(nCity) || (c.slug === "casablanca" && /^casa/.test(nCity))));
  const transport = pickup ? "Retrait au dépôt : gratuit" : !nCity ? "Indiquez votre ville" : (showPrices && cityHit) ? `${cityHit.name} : ${cityHit.fee} DH TTC (en option, hors total)` : "Transport à confirmer sur devis";

  const addRow = () => {
    const first = catalog.find((p) => p.orderable && !rows.some((r) => r.id === p.id));
    if (!first) return;
    setRows((r) => [...r, { key: nextKey, id: first.id, qty: 1 }]);
    setNextKey((k) => k + 1);
  };

  if (state?.refused) {
    return (
      <div className="shell max-w-2xl pt-12 sm:pt-16" data-testid="quote-refused">
        <div className="rounded-2xl border border-rule bg-sand p-6 sm:p-8">
          <CheckCircle2 className="size-8 text-copper" aria-hidden />
          <h1 className="mt-4 text-d2">Demande bien reçue</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">{state.message}</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={state.wa} target="_blank" rel="noopener" className="btn btn-primary" data-testid="quote-refused-wa">
              <WhatsAppIcon className="size-4" /> Écrire à Walfar sur WhatsApp
            </a>
            <Link href="/produits" className="btn btn-ghost">Retour aux produits</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell pt-10 pb-6 sm:pt-14">
      {!embedded && (
        <>
          <p className="eyebrow">Devis validé par l&apos;équipe</p>
          <h1 className="mt-3 text-d1">{showPrices ? "Votre devis en ligne" : "Ma demande de devis"}</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {showPrices
              ? "Prix HT, TVA 20 % et TTC, valable 14 jours, calculé à partir des prix du site. L'équipe FAW valide votre demande puis vous envoie le devis PDF. Fourniture seule, pose non comprise. Paiement par virement ou chèque."
              : "Indiquez vos produits, quantités et coordonnées. L'équipe FAW valide votre demande puis vous envoie le devis PDF, avec les prix et le transport. Fourniture seule, pose non comprise. Paiement par virement ou chèque."}
          </p>
        </>
      )}

      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          startTransition(() => action(fd));
        }}
        noValidate className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12" data-testid="quote-form">
        <FormGuard />
        <input type="hidden" name="clientType" value={type} />
        <input type="hidden" name="items" value={JSON.stringify(rows.map(({ id, qty }) => ({ id, qty })))} />
        <input type="hidden" name="attribution" value={attr} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="pickup" value={pickup ? "1" : "0"} />

        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Vous êtes</legend>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-rule p-1" role="radiogroup">
              {(["particulier", "entreprise"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={type === k}
                  onClick={() => setType(k)}
                  data-testid={`quote-type-${k}`}
                  className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition", type === k ? "bg-foreground text-background" : "text-foreground/75 hover:bg-muted")}
                >
                  {k === "particulier" ? <User className="size-4" aria-hidden /> : <Building2 className="size-4" aria-hidden />}
                  {k === "particulier" ? "Particulier" : "Entreprise"}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium">Nom et prénom</label>
              <input id="name" name="name" autoComplete="name" required className={inputCls} {...inv("name")} />
              <Err id="name" msg={e.name} />
            </div>
            <div>
              <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">Téléphone (WhatsApp)</label>
              <div className="relative" dir="ltr">
                <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3.5 text-[15px] text-muted-foreground">+212</span>
                <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" placeholder="6 12 34 56 78" required className={cn(inputCls, "ps-16")} {...inv("phone")} />
              </div>
              <Err id="phone" msg={e.phone} />
            </div>
          </div>

          <div>
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium">Ville</label>
            <input id="city" name="city" list="quote-cities" autoComplete="address-level2" required value={city} onChange={(ev) => setCity(ev.target.value)} className={inputCls} {...inv("city")} />
            <datalist id="quote-cities">{CITIES.map((c) => <option key={c} value={c} />)}</datalist>
            <Err id="city" msg={e.city} />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={pickup} onChange={(ev) => setPickup(ev.target.checked)} className="size-4 accent-[var(--primary)]" data-testid="quote-pickup" />
              Je retire au dépôt (gratuit)
            </label>
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium">E-mail *</label>
            <input id="email" name="email" type="email" required autoComplete="email" placeholder="pour recevoir le devis par e-mail" className={inputCls} dir="ltr" {...inv("email")} />
            <p className="mt-1 text-xs text-muted-foreground">Obligatoire : une fois validé par l&apos;équipe, le devis PDF vous est envoyé à cette adresse.</p>
            <Err id="email" msg={e.email} />
          </div>

          {!embedded && <fieldset>
            <legend className="mb-2 text-sm font-medium">Produits et quantités</legend>
            <ul className="space-y-2" data-testid="quote-lines">
              {rows.map((r, i) => {
                const p = byId.get(r.id);
                return (
                  <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-rule p-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="sr-only" htmlFor={`prod-${r.key}`}>Produit {i + 1}</label>
                    <select
                      id={`prod-${r.key}`}
                      value={r.id}
                      onChange={(ev) => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, id: ev.target.value } : x)))}
                      className="col-span-2 h-11 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-sm sm:col-span-1 dark:bg-input/20"
                      data-testid="quote-product-select"
                    >
                      {CATEGORIES.map((c) => (
                        <optgroup key={c.key} label={c.label}>
                          {catalog.filter((x) => x.cat === c.key).map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.title}{showPrices && x.price && x.price > 0 ? ` – ${formatDH(x.price)}` : showPrices ? " – prix à confirmer" : ""}{x.orderable ? "" : " (sur confirmation)"}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                      {shop.packs.length > 0 && (
                        <optgroup label="Packs">
                          {shop.packs.map((b) => (
                            <option key={b.product.id} value={b.product.id}>{b.product.title}{showPrices && b.price ? ` – ${formatDH(b.price)}` : ""}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="flex w-fit items-center rounded-lg border border-input" dir="ltr">
                      <button type="button" className="grid size-10 place-items-center" aria-label="Diminuer la quantité" onClick={() => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>
                        <Minus className="size-4" aria-hidden />
                      </button>
                      <input
                        aria-label={`Quantité ${p?.title ?? ""}`}
                        inputMode="numeric"
                        value={r.qty}
                        onChange={(ev) => {
                          const n = Math.max(1, Math.min(500, Number(ev.target.value.replace(/\D/g, "")) || 1));
                          setRows((all) => all.map((x) => (x.key === r.key ? { ...x, qty: n } : x)));
                        }}
                        className="h-10 w-10 bg-transparent text-center text-sm tnum outline-none"
                        data-testid="quote-qty"
                      />
                      <button type="button" className="grid size-10 place-items-center" aria-label="Augmenter la quantité" onClick={() => setRows((all) => all.map((x) => (x.key === r.key ? { ...x, qty: Math.min(500, x.qty + 1) } : x)))}>
                        <Plus className="size-4" aria-hidden />
                      </button>
                    </div>
                    <button type="button" aria-label="Retirer ce produit" disabled={rows.length === 1} onClick={() => setRows((all) => all.filter((x) => x.key !== r.key))} className="grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted disabled:opacity-30">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <Err id="items" msg={e.items} />
            <button type="button" onClick={addRow} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-copper hover:bg-muted" data-testid="quote-add-line">
              <Plus className="size-4" aria-hidden /> Ajouter un produit
            </button>
          </fieldset>}

          {hasKit && (
            <div>
              <label htmlFor="kitLeaf" className="mb-1.5 block text-sm font-medium">Largeur d&apos;un vantail du portail (m, facultatif)</label>
              <input id="kitLeaf" name="kitLeaf" inputMode="decimal" placeholder="ex. 2,2" className={cn(inputCls, "max-w-40")} data-testid="quote-kit-leaf" />
              <p className="mt-1 text-xs text-muted-foreground">Kit G-BAT 300 : 2,50 m maximum par vantail.</p>
            </div>
          )}

          <details open={proOpen} onToggle={(ev) => setProOpen((ev.target as HTMLDetailsElement).open)} className="rounded-xl border border-rule" data-testid="quote-pro">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">
              Informations professionnelles {type === "entreprise" ? "(raison sociale obligatoire)" : "(raison sociale, ICE)"}
            </summary>
            <div className="grid gap-4 px-4 pb-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="company" className="mb-1.5 block text-sm font-medium">Raison sociale{type === "entreprise" ? " *" : ""}</label>
                <input id="company" name="company" autoComplete="organization" className={inputCls} {...inv("company")} />
                <Err id="company" msg={e.company} />
              </div>
              <div>
                <label htmlFor="ice" className="mb-1.5 block text-sm font-medium">ICE (15 chiffres)</label>
                <input id="ice" name="ice" inputMode="numeric" maxLength={20} className={inputCls} dir="ltr" {...inv("ice")} />
                <Err id="ice" msg={e.ice} />
              </div>
            </div>
          </details>

          <details className="rounded-xl border border-rule">
            <summary className="flex min-h-12 cursor-pointer items-center px-4 text-sm font-semibold">Une précision ?</summary>
            <div className="space-y-3 px-4 pb-4">
              <label htmlFor="note" className="sr-only">Précision</label>
              <textarea id="note" name="note" rows={3} maxLength={600} className="w-full rounded-lg border border-input bg-background p-3 text-[15px] dark:bg-input/20" placeholder="Chantier, accès, question…" data-testid="quote-note" />
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" name="custom" value="1" className="size-4 accent-[var(--primary)]" data-testid="quote-custom" />
                Besoin de dimensions sur-mesure
              </label>
            </div>
          </details>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-rule bg-sand p-5">
            <p className="label-mono">{showPrices ? "Estimation" : "Demande"}</p>
            {showPrices ? (
              <>
                <p className="mt-2 text-3xl font-semibold tnum" data-testid="quote-estimate">{formatDH(total)}</p>
                <p className="text-sm text-muted-foreground">TTC, dont TVA 20 % : {formatDH(Math.round(total - total / 1.2))}</p>
                {tier && <p className="mt-2 text-sm font-medium text-copper">Tarif quantité appliqué : 2 000 DH TTC la porte (80, 90, 100 cm) dès 4 portes.</p>}
              </>
            ) : (
              <p className="mt-2 text-2xl font-semibold" data-testid="quote-estimate">Prix sur devis</p>
            )}
            <dl className="mt-4 space-y-1.5 border-t border-rule pt-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Transport</dt><dd className="text-end">{transport}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Pose</dt><dd className="text-end">Non comprise</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Validité</dt><dd className="text-end">14 jours</dd></div>
            </dl>
            {state && !state.refused && state.message && (
              <p role="alert" className="mt-4 flex items-start gap-1.5 text-sm font-medium text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden /> {state.message}
              </p>
            )}
            <button type="submit" disabled={pending || rows.length === 0} className="btn btn-primary mt-5 w-full" data-testid="quote-submit">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileText className="size-4" aria-hidden />}
              {pending ? "Envoi…" : showPrices ? "Générer mon devis PDF" : "Envoyer ma demande de devis"}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Aucun paiement en ligne. Vos coordonnées servent uniquement à établir et suivre ce devis (<Link href="/livraison#confidentialite" className="underline underline-offset-2">données personnelles</Link>).
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}
