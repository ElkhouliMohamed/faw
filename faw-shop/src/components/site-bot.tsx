"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, MessageCircleQuestion, X } from "lucide-react";
import { WhatsAppIcon } from "./icons";
import { FormGuard, useCart, useCatalog, useShop, useT } from "./providers";
import { readAttribution } from "./tracking";
import { botLead, type BotLeadState } from "@/app/actions/bot";
import { formatDH } from "@/lib/format";
import { CATEGORIES, categoryHref, type CategoryKey, type PublicProduct } from "@/lib/products";
import { waLink } from "@/lib/site";
import { cn } from "@/lib/utils";

type Step = "home" | "produit" | "taille" | "prix" | "delai" | "livraison" | "devis" | "walfar";

const LABELS = {
  fr: {
    hello: "Bonjour ! Je réponds à partir des fiches et des conditions du site. Que voulez-vous savoir ?",
    produit: "Quel produit ?",
    taille: "Quelle taille ?",
    prix: "Prix",
    delai: "Délai",
    livraison: "Livraison",
    devis: "Devis PDF",
    walfar: "Parler à Walfar",
    back: "Retour",
  },
  ar: {
    hello: "مرحبا! أجيب انطلاقا من أثمنة وشروط الموقع. ماذا تريد أن تعرف؟",
    produit: "أي منتوج؟",
    taille: "أي مقاس؟",
    prix: "الثمن",
    delai: "المدة",
    livraison: "التوصيل",
    devis: "عرض سعر PDF",
    walfar: "تحدث مع وَلفار",
    back: "رجوع",
  },
} as const;

const CAT_BLURB: Record<CategoryKey, string> = {
  "portes-coupe-feu": "Portes coupe-feu EI60, 1 vantail (80 à 120 cm) et 2 vantaux (120 à 200 cm), livrées avec poignée, cylindre, serrure et clés.",
  galandage: "Châssis pour porte coulissante encastrable (galandage), cloison placo, passages de 60 à 100 cm. Vantail non inclus.",
  incendie: "Extincteurs poudre ABC, CO2, eau pulvérisée, automatiques, RIA, poteau incendie et chariot mousse.",
  automatisme: "Kit moteur pour portail battant G-BAT 300 (Genius, fabriqué en Italie), conditions de garantie à confirmer.",
};

function range(list: PublicProduct[], showPrices: boolean) {
  if (!showPrices) return "prix sur devis";
  const p = list.filter((x) => (x.price ?? 0) > 0).map((x) => x.price as number);
  if (!p.length) return "prix à confirmer";
  const min = Math.min(...p);
  const max = Math.max(...p);
  return min === max ? formatDH(min) : `de ${formatDH(min)} à ${formatDH(max)}`;
}

/** Assistant du site : boutons guidés, réponses tirées du catalogue et des conditions (aucune IA externe). */
export function SiteBot() {
  const path = usePathname();
  const { locale } = useT();
  const L = LABELS[locale];
  const catalog = useCatalog();
  const { showPrices } = useShop();
  const { lines } = useCart();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("home");
  const [topic, setTopic] = useState("");
  const [state, action, pending] = useActionState<BotLeadState, FormData>(botLead, null);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [attr, setAttr] = useState("{}");

  useEffect(() => setAttr(readAttribution()), [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        opener.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    panel.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  const byCat = useMemo(() => {
    const m = new Map<CategoryKey, PublicProduct[]>();
    for (const p of catalog) m.set(p.cat, [...(m.get(p.cat) ?? []), p]);
    return m;
  }, [catalog]);
  const doors = catalog.filter((p) => p.variantGroup === "porte-coupe-feu-ei60");
  const gal = catalog.filter((p) => p.variantGroup === "galandage-chassis");
  const devisHref = lines.length ? `/devis?panier=1` : "/devis";

  if (path.startsWith("/admin") || path.startsWith("/commande")) return null;
  const product = /^\/produits\/[^/]+/.test(path) && !/^\/produits\/(portes-coupe-feu|portes-galandage|incendie)$/.test(path);

  const go = (s: Step, t?: string) => {
    setStep(s);
    if (t) setTopic(t);
  };
  const Btn = ({ s, label, t }: { s: Step; label: string; t?: string }) => (
    <button type="button" onClick={() => go(s, t ?? label)} className="rounded-full border border-input px-3 py-2 text-start text-sm font-medium hover:border-primary hover:bg-primary hover:text-primary-foreground" data-testid={`bot-${s}`}>
      {label}
    </button>
  );
  const Answer = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-2 rounded-lg bg-sand p-3 text-sm leading-relaxed" lang="fr" dir="ltr">{children}</div>
  );
  const sizeList = (list: PublicProduct[]) => (
    <ul className="mt-1 grid grid-cols-2 gap-1.5">
      {list.map((p) => (
        <li key={p.id}>
          <Link href={`/produits/${p.slug}`} onClick={() => setOpen(false)} className="flex flex-col rounded-md border border-rule bg-background px-2 py-1.5 hover:border-copper">
            <span className="text-xs font-semibold">{p.variantLabel ?? p.title}</span>
            <span className="text-[0.6875rem] tnum text-muted-foreground">{showPrices && p.price ? formatDH(p.price) : p.orderable ? "Prix sur devis" : p.availability}</span>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <>
      <button
        ref={opener}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="site-bot"
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant FAW"}
        data-testid="bot-toggle"
        className={cn(
          "fixed end-4 z-40 grid size-12 place-items-center rounded-full border border-rule bg-background text-foreground shadow-[var(--shadow-warm)] transition-transform hover:-translate-y-0.5 sm:end-6",
          product ? "bottom-[5.5rem] lg:bottom-[5.5rem]" : "bottom-[4.75rem] sm:bottom-[5.75rem]",
        )}
      >
        {open ? <X className="size-5" aria-hidden /> : <MessageCircleQuestion className="size-5" aria-hidden />}
      </button>

      {open && (
        <div
          ref={panel}
          id="site-bot"
          role="dialog"
          aria-label="Assistant FAW"
          data-testid="bot-panel"
          className={cn(
            "fixed inset-x-3 z-50 flex max-h-[min(70dvh,34rem)] flex-col overflow-hidden rounded-xl border border-rule bg-background shadow-[var(--shadow-warm)] sm:inset-x-auto sm:end-6 sm:w-[23rem]",
            product ? "bottom-[9.25rem]" : "bottom-[8.5rem] sm:bottom-[9.5rem]",
          )}
        >
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <p className="text-sm font-semibold">Assistant FAW</p>
            <button type="button" onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-md hover:bg-muted" aria-label="Fermer l'assistant">
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {step === "home" ? (
              <>
                <p className="text-sm text-muted-foreground">{L.hello}</p>
                <div className="flex flex-wrap gap-2">
                  <Btn s="produit" label={L.produit} />
                  <Btn s="taille" label={L.taille} />
                  <Btn s="prix" label={L.prix} />
                  <Btn s="delai" label={L.delai} />
                  <Btn s="livraison" label={L.livraison} />
                  <Btn s="devis" label={L.devis} />
                  <Btn s="walfar" label={L.walfar} />
                </div>
              </>
            ) : (
              <button type="button" onClick={() => setStep("home")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground" data-testid="bot-back">
                <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden /> {L.back}
              </button>
            )}

            {step === "produit" && (
              <ul className="space-y-2">
                {CATEGORIES.map((c) => (
                  <li key={c.key}>
                    <Answer>
                      <p className="font-semibold">{c.label}</p>
                      <p>{CAT_BLURB[c.key]}</p>
                      <Link href={categoryHref(c.key)} onClick={() => setOpen(false)} className="font-semibold text-copper underline-offset-4 hover:underline">Voir les produits →</Link>
                    </Answer>
                  </li>
                ))}
              </ul>
            )}

            {step === "taille" && (
              <Answer>
                <p className="font-semibold">Portes coupe-feu EI60 (hauteur 212,5 cm)</p>
                <p>Mesurez la largeur du passage : 80, 90 ou 100 cm pour la plupart des portes ; au-delà de 120 cm, choisissez 2 vantaux.</p>
                {sizeList(doors)}
                {gal.length > 0 && (
                  <>
                    <p className="pt-2 font-semibold">Châssis galandage (largeur de passage)</p>
                    {sizeList(gal)}
                  </>
                )}
              </Answer>
            )}

            {step === "prix" && (
              <Answer>
                <ul className="space-y-1.5">
                  {CATEGORIES.map((c) => (
                    <li key={c.key}><span className="font-semibold">{c.label}</span> : {range(byCat.get(c.key) ?? [], showPrices)}</li>
                  ))}
                </ul>
                {showPrices && <p>Porte EI60 1 vantail 80, 90 ou 100 cm : 2 000 DH TTC la porte dès 4 portes.</p>}
                <p>{showPrices ? "Prix TTC." : "Prix sur devis."} Pose non comprise. Paiement par virement ou chèque.</p>
              </Answer>
            )}

            {step === "delai" && (
              <Answer>
                <p>Les produits « En stock » peuvent être retirés au dépôt de Casablanca. Le délai de livraison est confirmé par l&apos;équipe FAW lors de la confirmation de votre commande.</p>
                <p>Sur-mesure : uniquement en grande quantité, étudié au cas par cas.</p>
              </Answer>
            )}

            {step === "livraison" && (
              <Answer>
                <p><span className="font-semibold">Portes coupe-feu</span> : {showPrices ? "Casablanca 400 DH, Rabat 800 DH, autres villes à confirmer." : "transport à confirmer sur devis."} Retrait gratuit au dépôt.</p>
                <p><span className="font-semibold">Kit G-BAT 300</span> : livraison partout au Maroc par transporteur, frais payés à la réception.</p>
                <p><span className="font-semibold">Galandage et incendie</span> : livraison sur devis ou retrait au dépôt.</p>
                <p>Pose non comprise.</p>
                <Link href="/livraison" onClick={() => setOpen(false)} className="font-semibold text-copper underline-offset-4 hover:underline">Toutes les conditions →</Link>
              </Answer>
            )}

            {step === "devis" && (
              <Answer>
                <p>Indiquez vos produits, quantités, ville et téléphone : l&apos;équipe FAW valide votre demande puis vous envoie le devis PDF (HT, TVA 20 %, TTC), valable 14 jours.</p>
                <Link href={devisHref} onClick={() => setOpen(false)} className="btn btn-primary mt-1 h-10 w-full text-sm" data-testid="bot-quote-link">Faire mon devis</Link>
              </Answer>
            )}

            {step === "walfar" &&
              (state?.ok ? (
                <Answer>
                  <p>Merci, vos coordonnées sont transmises à Walfar. Ouvrez WhatsApp pour lui écrire directement :</p>
                  <a href={state.wa} target="_blank" rel="noopener" className="btn btn-primary mt-1 h-10 w-full text-sm" data-testid="bot-wa-link">
                    <WhatsAppIcon className="size-4" /> Ouvrir WhatsApp
                  </a>
                </Answer>
              ) : (
                <form action={action} className="space-y-3" data-testid="bot-form" noValidate>
                  <FormGuard />
                  <input type="hidden" name="topic" value={topic === L.walfar ? "" : topic} />
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="attribution" value={attr} />
                  <p className="text-sm text-muted-foreground">Laissez votre nom et votre téléphone, puis écrivez à Walfar sur WhatsApp.</p>
                  <label className="block text-sm">
                    <span className="font-medium">Nom</span>
                    <input name="name" required autoComplete="name" className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3" aria-invalid={!!(state && !state.ok && state.errors?.name)} />
                    {state && !state.ok && state.errors?.name && <span className="text-xs text-destructive">{state.errors.name}</span>}
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium">Téléphone</span>
                    <input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="06 12 34 56 78" dir="ltr" className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3" aria-invalid={!!(state && !state.ok && state.errors?.phone)} />
                    {state && !state.ok && state.errors?.phone && <span className="text-xs text-destructive">{state.errors.phone}</span>}
                  </label>
                  {state && !state.ok && !state.errors && <p role="alert" className="text-sm text-destructive">{state.message}</p>}
                  <button type="submit" disabled={pending} className="btn btn-primary h-11 w-full text-sm" data-testid="bot-submit">
                    {pending ? "Envoi…" : "Continuer vers WhatsApp"}
                  </button>
                  <a href={waLink("Bonjour Walfar, j'ai une question sur vos produits.")} target="_blank" rel="noopener" className="block text-center text-xs text-muted-foreground underline underline-offset-2">
                    Écrire directement sur WhatsApp
                  </a>
                </form>
              ))}
          </div>
        </div>
      )}
    </>
  );
}
