"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./logo";
import { LocaleToggle, ThemeToggle } from "./toggles";
import { useCart, useShop, useT } from "./providers";
import { WhatsAppIcon } from "./icons";
import { SITE, waLink } from "@/lib/site";
import { cn } from "@/lib/utils";

export function Header() {
  const { t } = useT();
  const { showPrices } = useShop();
  const { count, ready } = useCart();
  const cartLabel = showPrices ? t.nav.cart : t.nav.cartQuote;
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const nav = [
    { href: "/produits", label: t.nav.shop },
    { href: "/livraison", label: t.nav.delivery },
    { href: "/contact", label: t.nav.contact },
  ];
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  const has = ready && count > 0;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-rule bg-background/90 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="shell flex h-16 items-center gap-2 lg:h-[72px]">
          <Link href="/" className="me-auto shrink-0 rounded-lg" aria-label="FAW Aluminium – accueil">
            <Logo className="h-8 lg:h-9" priority />
          </Link>
          <nav aria-label="Navigation principale" className="hidden items-center gap-8 lg:flex">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active(n.href) ? "page" : undefined}
                className="relative py-2 text-[0.9375rem] font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
              >
                {n.label}
                {active(n.href) && <span className="absolute inset-x-0 -bottom-px h-px bg-foreground" aria-hidden />}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1 lg:ms-8">
            <LocaleToggle className="hidden sm:inline-flex" />
            <ThemeToggle />
            <Link
              href="/panier"
              data-testid="cart-link"
              aria-label={`${cartLabel}${has ? ` (${count})` : ""}`}
              className="ms-1 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rule px-3 text-sm font-medium transition-colors hover:border-foreground/40"
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
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-sand lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? t.nav.close : t.nav.menu}
              onClick={() => setOpen((o) => !o)}
            >
              <span className="relative block h-3 w-5" aria-hidden>
                <span className={cn("absolute inset-x-0 top-0 h-px bg-foreground transition-transform duration-300", open && "translate-y-[5.5px] rotate-45")} />
                <span className={cn("absolute inset-x-0 bottom-0 h-px bg-foreground transition-transform duration-300", open && "-translate-y-[5.5px] -rotate-45")} />
              </span>
            </button>
          </div>
        </div>
      </header>

      {open && (
        <nav id="mobile-nav" aria-label="Navigation mobile" className="fixed inset-x-0 top-16 bottom-0 z-[48] flex flex-col overflow-y-auto bg-background lg:hidden">
          <ul className="shell pt-4">
            {[{ href: "/", label: t.nav.home }, ...nav, { href: "/panier", label: cartLabel }].map((n) => (
              <li key={n.href} className="border-b border-rule">
                <Link href={n.href} aria-current={active(n.href) ? "page" : undefined} className="flex items-center justify-between py-4 text-d3 font-semibold aria-[current=page]:text-copper">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="shell mt-auto space-y-4 pt-8 pb-8">
            <a href={waLink()} target="_blank" rel="noopener" className="flex items-center justify-between border-t border-rule pt-4">
              <span className="flex items-center gap-2"><WhatsAppIcon className="size-5" /> <span dir="ltr">{SITE.whatsappDisplay}</span></span>
              <ArrowUpRight className="size-5 rtl:-scale-x-100" />
            </a>
            <LocaleToggle className="-ms-2.5" />
          </div>
        </nav>
      )}
    </>
  );
}
