"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Clock, Mail, Phone, ShoppingBag } from "lucide-react";
import { Logo } from "./logo";
import { LocaleToggle, ThemeToggle } from "./toggles";
import { useCart, useCartDrawer, useShop, useT } from "./providers";
import { WhatsAppIcon } from "./icons";
import { HomeIcon } from "./home/icon";
import { cn } from "@/lib/utils";

export type HeaderLink = { label: string; url: string; newTab?: boolean; highlight?: boolean; children?: { label: string; url: string; newTab?: boolean }[] };
export type HeaderContact = { phone: string; phoneHref: string; whatsappHref: string; whatsappDisplay: string; email: string; hours: string };
export type HeaderCta = { label: string; url: string; icon: string; showPhone: boolean } | null;

const isExternal = (url: string) => /^(https:|tel:|mailto:)/.test(url);

function NavLink({ item, className, current, onNavigate }: { item: { label: string; url: string; newTab?: boolean }; className: string; current?: boolean; onNavigate?: () => void }) {
  if (isExternal(item.url) || item.newTab)
    return (
      <a href={item.url} className={className} {...(item.newTab ? { target: "_blank", rel: "noopener" } : {})}>
        {item.label}
      </a>
    );
  return (
    <Link href={item.url} aria-current={current ? "page" : undefined} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  );
}

const DESKTOP_LINK =
  "relative py-2 text-[0.9375rem] font-semibold text-foreground transition-colors hover:text-copper aria-[current=page]:text-copper aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:-bottom-0.5 aria-[current=page]:after:h-0.5 aria-[current=page]:after:rounded aria-[current=page]:after:bg-flame";

/** Lien du menu avec sous-liens : survol ou bouton ▾ (clavier), Échap pour fermer. */
function Dropdown({ item, current, submenuLabel }: { item: HeaderLink; current: boolean; submenuLabel: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // useId : libellés arabes (aucun caractère \w) ou en double ne donnent pas d'id identiques.
  const id = useId();
  useEffect(() => setOpen(false), [path]);
  return (
    <div
      className="relative flex items-center gap-0.5"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setOpen(false)}
    >
      <NavLink item={item} current={current} className={DESKTOP_LINK} />
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${submenuLabel} : ${item.label}`}
        onClick={() => setOpen((o) => !o)}
        className="grid size-7 place-items-center rounded-md text-foreground/70 hover:text-copper"
      >
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      <div id={id} hidden={!open} className="absolute start-0 top-full z-50 pt-3">
        <ul className="min-w-60 rounded-xl bg-card p-2 shadow-soft ring-1 ring-rule">
          {item.children?.map((c) => (
            <li key={`${c.url}-${c.label}`}>
              <NavLink item={c} className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-sand hover:text-copper" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * En-tête collant blanc (maquette) : logo, menu (Filament : Menus du site, « Produits ▾ » avec sous-liens), bouton orange
 * téléphone / devis (Filament : En-tête & pied de page), panier. Mobile : appel / WhatsApp en un geste, menu burger plein écran.
 */
export function Header({ links, contact, logo, logoDark, cta }: { links: HeaderLink[]; contact: HeaderContact; logo?: string | null; logoDark?: string | null; cta: HeaderCta }) {
  const { t } = useT();
  const { showPrices } = useShop();
  const { count, ready } = useCart();
  const { openCart, open: drawerOpen } = useCartDrawer();
  const cartLabel = showPrices ? t.nav.cart : t.nav.cartQuote;
  // L'adresse affichée garde le préfixe de langue (/fr, /ar) : on le retire pour reconnaître le lien actif (« Accueil » en orange).
  const path = (usePathname() || "/").replace(/^\/(?:fr|ar)(?=\/|$)/, "") || "/";
  const [open, setOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    root.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        burger.current?.focus();
      }
    };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => wide.matches && setOpen(false);
    window.addEventListener("keydown", esc);
    wide.addEventListener("change", onWide);
    return () => {
      root.style.overflow = "";
      window.removeEventListener("keydown", esc);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  const active = (h: string) => !isExternal(h) && !h.includes("#") && (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  const has = ready && count > 0;
  const plain = links.filter((l) => !l.highlight);
  const buttons = links.filter((l) => l.highlight);
  const close = () => setOpen(false);
  const mobileLinks = links.some((l) => l.url === "/") ? links : [{ url: "/", label: t.nav.home }, ...links];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-rule bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/90">
        <div className="shell flex h-16 items-center gap-1 lg:h-20 lg:gap-2">
          <Link href="/" className="me-auto shrink-0 rounded-lg py-2" aria-label="FAW Aluminium – accueil">
            <Logo className="h-8 lg:h-10" priority sizes="(min-width:1024px) 140px, 112px" src={logo} darkSrc={logoDark} />
          </Link>
          <nav aria-label="Navigation principale" className="hidden items-center gap-6 lg:flex xl:gap-8">
            {plain.map((n) =>
              n.children?.length ? (
                <Dropdown key={`${n.url}-${n.label}`} item={n} current={active(n.url)} submenuLabel={t.layout.submenu} />
              ) : (
                <NavLink key={`${n.url}-${n.label}`} item={n} current={active(n.url)} className={DESKTOP_LINK} />
              ),
            )}
          </nav>
          <div className="flex items-center gap-1 lg:ms-8">
            {buttons.map((n) => (
              <NavLink key={`${n.url}-${n.label}`} item={n} current={active(n.url)} className="btn btn-primary hidden h-11 rounded-xl px-4 lg:inline-flex" />
            ))}
            {cta && <CtaButton cta={cta} phone={contact.phone} />}
            {/* Mobile / tablette : appel et WhatsApp en un geste (cibles 44 px) */}
            <a href={contact.phoneHref} aria-label={`${t.home.ctaCall} ${contact.phone}`} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-sand lg:hidden" data-testid="header-call">
              <Phone className="size-5" aria-hidden />
            </a>
            <a href={contact.whatsappHref} target="_blank" rel="noopener" aria-label={t.home.ctaWa} className="inline-flex size-11 items-center justify-center rounded-lg text-wa hover:bg-sand dark:text-[#5fd393] lg:hidden" data-testid="header-whatsapp">
              <WhatsAppIcon className="size-5" />
            </a>
            <LocaleToggle className="hidden lg:inline-flex" />
            <Link
              href="/panier"
              role="button"
              data-testid="cart-link"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              aria-label={`${cartLabel}${has ? ` (${count})` : ""}`}
              onClick={(e) => {
                // Sans JavaScript (ou clic molette / Ctrl) : page /panier ; sinon panier latéral.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                setOpen(false);
                openCart();
              }}
              className="relative inline-flex size-11 items-center justify-center rounded-lg transition-colors hover:bg-sand"
            >
              <ShoppingBag className="size-5" aria-hidden />
              <span
                data-testid={has ? "cart-count" : undefined}
                className={cn(
                  "absolute end-0.5 top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[0.6875rem] font-semibold tnum transition-colors",
                  has ? "bg-primary text-primary-foreground" : "bg-sand text-muted-foreground",
                )}
              >
                {ready ? count : 0}
              </span>
            </Link>
            <button
              ref={burger}
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-sand lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t.nav.close : t.nav.menu}
              onClick={() => setOpen((o) => !o)}
            >
              <span className="relative block h-3 w-5" aria-hidden>
                <span className={cn("absolute inset-x-0 top-0 h-0.5 rounded bg-foreground transition-transform duration-300", open && "translate-y-[5px] rotate-45")} />
                <span className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded bg-foreground transition-transform duration-300", open && "-translate-y-[5px] -rotate-45")} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <nav id="mobile-nav" aria-label="Navigation mobile" className="fixed inset-x-0 top-16 bottom-0 z-[48] flex flex-col overflow-y-auto overscroll-contain bg-background lg:hidden">
          <ul className="shell pt-2">
            {[...mobileLinks, { url: "/panier", label: cartLabel } as HeaderLink].map((n) => (
              <li key={`${n.url}-${n.label}`} className="border-b border-rule">
                <NavLink
                  item={n}
                  current={active(n.url)}
                  onNavigate={close}
                  className="flex min-h-14 items-center justify-between py-3 text-[1.25rem] font-semibold aria-[current=page]:text-copper"
                />
                {n.children?.length ? (
                  <ul className="-mt-1 pb-3 ps-4">
                    {n.children.map((c) => (
                      <li key={`${c.url}-${c.label}`}>
                        <NavLink item={c} onNavigate={close} className="flex min-h-11 items-center text-[1rem] text-muted-foreground hover:text-foreground" />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="shell mt-auto pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {cta && (
              <NavLink item={{ url: cta.url, label: cta.label }} onNavigate={close} className="btn btn-primary mb-3 h-14 w-full rounded-xl" />
            )}
            <div className="grid grid-cols-2 gap-3">
              <a href={contact.phoneHref} className="btn btn-ghost h-auto min-h-14 flex-col gap-0.5 rounded-xl py-2">
                <span className="inline-flex items-center gap-2"><Phone className="size-4" aria-hidden /> {t.home.ctaCall}</span>
                <span dir="ltr" className="text-xs font-medium tnum text-muted-foreground">{contact.phone}</span>
              </a>
              <a href={contact.whatsappHref} target="_blank" rel="noopener" className="btn h-auto min-h-14 flex-col gap-0.5 rounded-xl bg-wa py-2 text-white">
                <span className="inline-flex items-center gap-2"><WhatsAppIcon className="size-4" /> WhatsApp</span>
                <span dir="ltr" className="text-xs font-medium tnum">{contact.whatsappDisplay}</span>
              </a>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2"><Mail className="size-4 shrink-0" aria-hidden /><a href={`mailto:${contact.email}`} className="break-all hover:text-foreground">{contact.email}</a></li>
              <li className="flex items-center gap-2"><Clock className="size-4 shrink-0" aria-hidden /><span>{contact.hours}</span></li>
            </ul>
            <div className="mt-6 flex items-center justify-between border-t border-rule pt-4">
              <LocaleToggle className="-ms-2.5" />
              <ThemeToggle />
            </div>
          </div>
        </nav>
      )}
    </>
  );
}

/** Bouton orange de l'en-tête : numéro (facultatif) au-dessus du texte, icône à droite. */
function CtaButton({ cta, phone }: { cta: NonNullable<HeaderCta>; phone: string }) {
  const inner = (
    <>
      <span className="flex flex-col items-start text-start leading-tight">
        {cta.showPhone && <span dir="ltr" className="text-[0.75rem] font-semibold tnum opacity-90">{phone}</span>}
        <span className="text-[0.875rem] font-bold">{cta.label}</span>
      </span>
      <HomeIcon name={cta.icon} className="size-5 shrink-0" strokeWidth={2} />
    </>
  );
  const cls = "btn btn-primary hidden h-12 gap-3 rounded-xl px-4 shadow-soft lg:inline-flex";
  return isExternal(cta.url) ? (
    <a href={cta.url} className={cls} data-testid="header-cta">{inner}</a>
  ) : (
    <Link href={cta.url} className={cls} data-testid="header-cta">{inner}</Link>
  );
}
