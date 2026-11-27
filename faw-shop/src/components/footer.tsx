import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon, SocialIcon } from "./icons";
import { Logo } from "./logo";
import { ConsentReset } from "./consent";
import { ThemeToggle } from "./toggles";
import type { Dict } from "@/lib/i18n";
import { waHref, type Contact, type Menu, type MenuItem, type SiteContent, type SiteLayout } from "@/lib/site-content";

const SOCIAL_LABEL = { instagram: "Instagram", linkedin: "LinkedIn", facebook: "Facebook", youtube: "YouTube" } as const;
const isExternal = (url: string) => /^(https:|tel:|mailto:)/.test(url);

function FooterLink({ item, className = "inline-flex min-h-7 items-center hover:text-flame" }: { item: MenuItem; className?: string }) {
  if (isExternal(item.url) || item.newTab)
    return (
      <a className={className} href={item.url} {...(item.newTab ? { target: "_blank", rel: "noopener" } : {})}>
        {item.label}
      </a>
    );
  return (
    <Link className={className} href={item.url}>
      {item.label}
    </Link>
  );
}

function Column({ id, menu }: { id: string; menu: Menu }) {
  return (
    <nav className="sm:col-span-1 lg:col-span-2" aria-labelledby={id}>
      <h2 id={id} className="text-[0.9375rem] font-bold text-white">{menu.title}</h2>
      <ul className="mt-4 space-y-1">
        {menu.items.map((item) => (
          <li key={`${item.url}-${item.label}`}><FooterLink item={item} /></li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Pied de page brun (maquette) : logo, texte, réseaux sociaux ; colonnes « Liens rapides » / « Nos produits » (Menus du site) ;
 * colonne Contact (Coordonnées & réseaux sociaux) ; bas de page : copyright et liens légaux (En-tête & pied de page, Menus du site).
 */
export function Footer({
  t,
  contact,
  socials,
  menus,
  layout,
  categories = [],
  logoDark,
}: {
  t: Dict;
  contact: Contact;
  socials: SiteContent["socials"];
  menus: SiteContent["menus"];
  layout: SiteLayout | null;
  categories?: { path: string; label: string }[];
  logoDark?: string | null;
}) {
  const L = t.layout;
  const quick: Menu = menus.footerInfo ?? {
    title: L.quickLinks,
    items: [
      { label: t.nav.home, url: "/" },
      { label: L.products, url: "/produits" },
      { label: L.solutions, url: "/#solutions" },
      { label: L.projects, url: "/#realisations" },
      { label: L.about, url: "/#a-propos" },
      { label: t.nav.contact, url: "/contact" },
    ],
  };
  const products: Menu = menus.footerShop ?? {
    title: L.ourProducts,
    items: [...categories.map((c) => ({ label: c.label, url: c.path })), { label: t.v4.quote, url: "/devis" }],
  };
  const legal: MenuItem[] = menus.footerLegal?.items ?? [
    { label: L.legalNotice, url: "/livraison#mentions" },
    { label: L.privacy, url: "/livraison#confidentialite" },
  ];
  const text = layout ? layout.footerText : L.footerText;
  const contactTitle = layout?.footerContactTitle || L.contactTitle;
  const copyright = (layout?.copyright || L.copyright).replace("{year}", String(new Date().getFullYear()));
  const line = "flex items-start gap-3";
  const icon = "mt-0.5 size-4 shrink-0 text-flame";

  return (
    <footer className="bg-bark text-[0.875rem] text-bark-fg/75">
      <div className="shell grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-12 lg:py-16">
        <div className="sm:col-span-2 lg:col-span-4">
          <Logo onDark className="h-12" sizes="170px" darkSrc={logoDark} />
          {text && <p className="mt-5 max-w-xs leading-relaxed">{text}</p>}
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-2.5" data-testid="socials">
              {socials.map((s) => (
                <li key={s.key}>
                  <a href={s.url} target="_blank" rel="noopener me" aria-label={`${L.followUs} ${SOCIAL_LABEL[s.key]}`} className="grid size-10 place-items-center rounded-full border border-bark-fg/25 text-white transition-colors hover:border-flame hover:text-flame">
                    <SocialIcon k={s.key} className="size-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Column id="f-quick" menu={quick} />
        <Column id="f-products" menu={products} />
        <div className="sm:col-span-2 lg:col-span-4">
          <h2 className="text-[0.9375rem] font-bold text-white">{contactTitle}</h2>
          <address className="mt-4 space-y-3 not-italic">
            <p className={line}><Phone className={icon} aria-hidden /><a href={contact.phoneHref} dir="ltr" className="hover:text-flame">{contact.phone}</a></p>
            <p className={line}><WhatsAppIcon className={icon} /><a href={waHref(contact)} target="_blank" rel="noopener" dir="ltr" className="hover:text-flame">{contact.whatsappDisplay}</a></p>
            <p className={line}><Mail className={icon} aria-hidden /><a href={`mailto:${contact.email}`} className="break-all hover:text-flame">{contact.email}</a></p>
            <p className={line}><MapPin className={icon} aria-hidden /><a href={contact.mapsUrl} target="_blank" rel="noopener" className="hover:text-flame">{contact.address}</a></p>
            {contact.hours && <p className={line}><Clock className={icon} aria-hidden /><span>{contact.hours}</span></p>}
          </address>
        </div>
      </div>
      <div className="border-t border-bark-fg/10">
        <div className="shell flex flex-col gap-3 py-5 text-[0.8125rem] sm:flex-row sm:items-center sm:justify-between">
          <p>{copyright}</p>
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 sm:gap-x-3">
            {legal.map((item, i) => (
              <li key={`${item.url}-${item.label}`} className="flex items-center gap-3">
                {i > 0 && <span aria-hidden className="hidden opacity-40 sm:inline">|</span>}
                <FooterLink item={item} />
              </li>
            ))}
            <li className="flex items-center gap-3"><span aria-hidden className="hidden opacity-40 sm:inline">|</span><ConsentReset label={L.cookies} /></li>
            <li><ThemeToggle className="size-9 text-bark-fg/75 hover:bg-white/10 hover:text-white" /></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
