"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Clock, Mail, Phone } from "lucide-react";
import { Logo } from "./logo";
import { LocaleToggle, ThemeToggle } from "./toggles";
import { useCart, useShop, useT } from "./providers";
import { WhatsAppIcon } from "./icons";
import { cn } from "@/lib/utils";

export type HeaderLink = { label: string; url: string; newTab?: boolean; highlight?: boolean };
export type HeaderContact = { phone: string; phoneHref: string; whatsappHref: string; whatsappDisplay: string; email: string; hours: string };

const isExternal = (url: string) => /^(https:|tel:|mailto:)/.test(url);

function NavLink({ item, className, current, onNavigate }: { item: HeaderLink; className: string; current?: boolean; onNavigate?: () => void }) {
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

/**
 * En-tête collant, mobile d'abord : logo, appel / WhatsApp en un geste sous 1024 px, panier, menu burger plein écran.
 * Liens : menu « En-tête » de Filament (Menus du site), sinon liens par défaut (fournis par le layout).
 */
export function Header({ links, contact, logo, logoDark }: { links: HeaderLink[]; contact: HeaderContact; logo?: string | null; logoDark?: string | null }) {
  const { t } = useT();
  const { showPrices } = useShop();
  const { count, ready } = useCart();
  const cartLabel = showPrices ? t.nav.cart : t.nav.cartQuote;
  const path = usePathname();
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

  const active = (h: string) => !isExternal(h) && (h === "/" ? path === "/" : path === h || path.startsWith(`${h}/`));
  const has = ready && count > 0;
  const plain = links.filter((l) => !l.highlight);
  const buttons = links.filter((l) => l.highlight);
  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-rule bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/85">
        <div className="shell flex h-16 items-center gap-1 lg:h-[72px] lg:gap-2">
          <Link href="/" className="me-auto shrink-0 rounded-lg py-2" aria-label="FAW Aluminium – accueil">
            <Logo className="h-8 lg:h-9" priority sizes="(min-width:1024px) 126px, 112px" src={logo} darkSrc={logoDark} />
          </Link>
          <nav aria-label="Navigation principale" className="hidden items-center gap-7 lg:flex">
            {plain.map((n) => (
              <NavLink
                key={`${n.url}-${n.label}`}
                item={n}
                current={active(n.url)}
                className="relative py-2 text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground aria-[current=page]:after:absolute aria-[current=page]:after:inset-x-0 aria-[current=page]:after:-bottom-px aria-[current=page]:after:h-px aria-[current=page]:after:bg-foreground"
              />
            ))}
          </nav>
          <div className="flex items-center gap-1 lg:ms-6">
            {buttons.map((n) => (
              <NavLink key={`${n.url}-${n.label}`} item={n} current={active(n.url)} className="btn btn-primary hidden h-11 px-4 lg:inline-flex" />
            ))}
            <a
              href={contact.phoneHref}
              className="hidden min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold tnum hover:bg-sand xl:inline-flex"
              data-testid="header-phone"
            >
              <Phone className="size-4" aria-hidden />
              <span dir="ltr">{contact.phone}</span>
            </a>
            {/* Mobile / tablette : appel et WhatsApp en un geste (cibles 44 px) */}
            <a href={contact.phoneHref} aria-label={`${t.home.ctaCall} ${contact.phone}`} className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-sand lg:hidden" data-testid="header-call">
              <Phone className="size-5" aria-hidden />
            </a>
            <a href={contact.whatsappHref} target="_blank" rel="noopener" aria-label={t.home.ctaWa} className="inline-flex size-11 items-center justify-center rounded-lg text-[#128c4a] hover:bg-sand dark:text-[#5fd393] lg:hidden" data-testid="header-whatsapp">
              <WhatsAppIcon className="size-5" />
            </a>
            <LocaleToggle className="hidden lg:inline-flex" />
            <ThemeToggle className="hidden sm:inline-flex" />
            <Link
              href="/panier"
              data-testid="cart-link"
              aria-label={`${cartLabel}${has ? ` (${count})` : ""}`}
              className="ms-0.5 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rule px-2.5 text-sm font-medium transition-colors hover:border-foreground/40 sm:px-3"
            >
              <span className="hidden sm:inline">{cartLabel}</span>
              <span
                data-testid={has ? "cart-count" : undefined}
                className={cn(
                  "grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[0.6875rem] font-semibold tnum transition-colors",
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
            {[{ url: "/", label: t.nav.home }, ...links, { url: "/panier", label: cartLabel }].map((n) => (
              <li key={`${n.url}-${n.label}`} className="border-b border-rule">
                <NavLink
                  item={n}
                  current={active(n.url)}
                  onNavigate={close}
                  className="flex min-h-14 items-center justify-between py-3 text-[1.25rem] font-semibold aria-[current=page]:text-copper"
                />
              </li>
            ))}
          </ul>
          <div className="shell mt-auto pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-2 gap-3">
              <a href={contact.phoneHref} className="btn btn-ghost h-auto min-h-14 flex-col gap-0.5 py-2">
                <span className="inline-flex items-center gap-2"><Phone className="size-4" aria-hidden /> {t.home.ctaCall}</span>
                <span dir="ltr" className="text-xs font-medium tnum text-muted-foreground">{contact.phone}</span>
              </a>
              <a href={contact.whatsappHref} target="_blank" rel="noopener" className="btn btn-primary h-auto min-h-14 flex-col gap-0.5 py-2">
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
