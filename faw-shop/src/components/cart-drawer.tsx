"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, FileText, Loader2, ShoppingBag, Truck, X } from "lucide-react";
import { useCart, useShop, useT } from "./providers";
import { CartLines, useCartPreview } from "./cart-summary";
import { commerceDict } from "@/lib/commerce-dict";
import { formatMAD } from "@/lib/money";
import { cn } from "@/lib/utils";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Panier latéral (droite, gauche en arabe ; plein écran sur mobile). Chargé à la demande (import dynamique).
 * Dialogue modal : focus piégé, Échap / clic sur le voile pour fermer, défilement de la page bloqué,
 * animation désactivée si l'utilisateur préfère moins de mouvement. Totaux : serveur uniquement.
 */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale } = useT();
  const c = commerceDict(locale);
  const { showPrices } = useShop();
  const { ready, rows, count } = useCart();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  // Monté déjà ouvert au premier appel : l'état « visible » passe à vrai à l'image suivante pour jouer la transition.
  const [shown, setShown] = useState(false);
  // Fermé : retiré du rendu après l'animation (un panneau hors écran à gauche, en arabe, élargirait la page).
  const [gone, setGone] = useState(!open);
  useEffect(() => {
    if (open) setGone(false);
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(open)));
    const t = open ? undefined : setTimeout(() => setGone(true), 320);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, [open]);

  // Totaux serveur seulement quand le tiroir est ouvert (pas d'appel en arrière-plan).
  const preview = useCartPreview(open);
  const data = preview.data;
  const quoteOnly = rows.some((r) => r.product.quoteOnly) || !!data?.quoteRequired;

  // Changement de page (lien du tiroir, retour arrière) : fermeture.
  const path = usePathname();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    const gutter = window.innerWidth - root.clientWidth;
    root.style.overflow = "hidden";
    if (gutter > 0) root.style.paddingInlineEnd = `${gutter}px`;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const els = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const firstEl = els[0];
      const lastEl = els[els.length - 1];
      if (!panel.current.contains(document.activeElement)) {
        e.preventDefault();
        firstEl.focus();
      } else if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      root.style.paddingInlineEnd = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Focus sur « Fermer » une fois le panneau visible (un élément masqué ne peut pas recevoir le focus).
  useEffect(() => {
    if (!open || !shown) return;
    const t = setTimeout(() => closeBtn.current?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(t);
  }, [open, shown]);

  const title = showPrices ? c.drawer.title : c.drawer.titleQuote;
  const empty = ready && rows.length === 0;

  return (
    <div
      className={cn("fixed inset-0 z-[70] transition-[visibility] duration-300 motion-reduce:duration-0", shown ? "visible" : "invisible", gone && "hidden")}
      inert={!open}
      data-testid="cart-drawer"
      data-state={open ? "open" : "closed"}
    >
      <div
        className={cn("absolute inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-300 motion-reduce:transition-none", shown ? "opacity-100" : "opacity-0")}
        onClick={onClose}
        aria-hidden
        data-testid="cart-drawer-overlay"
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={cn(
          "absolute inset-y-0 end-0 flex w-full flex-col bg-paper shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none sm:max-w-[26.5rem] sm:rounded-s-3xl",
          shown ? "translate-x-0" : "translate-x-full rtl:-translate-x-full",
        )}
      >
        <header className="flex items-center gap-3 border-b border-rule px-5 py-4">
          <span className="grid size-10 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--flame)_14%,var(--card))] text-copper" aria-hidden>
            <ShoppingBag className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="cart-drawer-title" className="text-lg font-bold leading-tight text-ink dark:text-foreground">{title}</h2>
            {!empty && ready && <p className="text-xs text-muted-foreground tnum">{c.drawer.items(count)}</p>}
          </div>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label={c.drawer.close} className="grid size-11 place-items-center rounded-xl text-foreground transition-colors hover:bg-sand" data-testid="cart-drawer-close">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center" data-testid="cart-drawer-empty">
            <span className="grid size-20 place-items-center rounded-full bg-sand text-copper" aria-hidden>
              <ShoppingBag className="size-9" strokeWidth={1.5} />
            </span>
            <p className="mt-5 text-lg font-semibold">{c.drawer.empty}</p>
            <p className="mt-2 text-sm text-muted-foreground">{c.drawer.emptyHelp}</p>
            <Link href="/produits" onClick={onClose} className="btn btn-primary mt-6 rounded-xl px-6">
              {c.drawer.browse} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <CartLines preview={preview} compact onNavigate={onClose} />
            </div>

            <footer className="border-t border-rule bg-card px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_30px_-20px_rgb(58_36_22/0.35)]">
              {showPrices && !quoteOnly && (
                <>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium text-muted-foreground">{c.drawer.subtotal}</span>
                    <span className="min-h-7 text-xl font-bold tnum text-ink dark:text-foreground" dir="ltr" data-testid="drawer-subtotal" aria-live="polite">
                      {data?.subtotalTtc != null ? formatMAD(data.subtotalTtc) : preview.loading ? <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label={c.cart.computing} /> : "—"}
                    </span>
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Truck className="size-3.5 shrink-0" aria-hidden /> {c.drawer.shippingNote}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                    <Link href="/panier" onClick={onClose} className="btn btn-ghost h-12 rounded-xl px-3" data-testid="drawer-view-cart">
                      {c.drawer.viewCart}
                    </Link>
                    <Link href="/commande" onClick={onClose} className="btn btn-primary h-12 rounded-xl px-3 shadow-soft" data-testid="drawer-checkout">
                      {c.drawer.order} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                    </Link>
                  </div>
                </>
              )}
              {showPrices && quoteOnly && (
                <p className="mb-3 rounded-xl border border-copper/30 bg-sand p-3 text-xs leading-relaxed" role="status">{c.cart.quoteNeeded}</p>
              )}
              <Link
                href="/devis?panier=1"
                onClick={onClose}
                className={cn("btn w-full rounded-xl px-3", showPrices && !quoteOnly ? "mt-2.5 h-11 text-sm text-foreground hover:text-copper" : "btn-primary h-12")}
                data-testid="drawer-quote"
              >
                <FileText className="size-4" aria-hidden /> {c.drawer.toQuote}
              </Link>
              {(!showPrices || quoteOnly) && (
                <Link href="/panier" onClick={onClose} className="btn btn-ghost mt-2.5 h-11 w-full rounded-xl" data-testid="drawer-view-cart">
                  {showPrices ? c.drawer.viewCart : c.drawer.viewQuote}
                </Link>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
