import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WhatsAppIcon, SocialIcon } from "./icons";
import { Logo } from "./logo";
import { SITE } from "@/lib/site";
import { ConsentReset } from "./consent";
import type { Dict } from "@/lib/i18n";
import { waHref, type Contact, type Menu, type MenuItem, type SiteContent } from "@/lib/site-content";

const SOCIAL_LABEL = { instagram: "Instagram", linkedin: "LinkedIn", facebook: "Facebook" } as const;
const isExternal = (url: string) => /^(https:|tel:|mailto:)/.test(url);

function FooterLink({ item }: { item: MenuItem }) {
  const cls = "inline-flex min-h-8 items-center hover:text-flame";
  if (isExternal(item.url) || item.newTab)
    return (
      <a className={cls} href={item.url} {...(item.newTab ? { target: "_blank", rel: "noopener" } : {})}>
        {item.label}
      </a>
    );
  return (
    <Link className={cls} href={item.url}>
      {item.label}
    </Link>
  );
}

function Column({ id, menu }: { id: string; menu: Menu }) {
  return (
    <nav className="col-span-6 lg:col-span-2" aria-labelledby={id}>
      <h2 id={id} className="eyebrow opacity-60">{menu.title}</h2>
      <ul className="mt-4 space-y-2">
        {menu.items.map((item) => (
          <li key={`${item.url}-${item.label}`}><FooterLink item={item} /></li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Pied de page. Colonnes « Boutique » / « Informations » / liens légaux : menus de Filament (Menus du site) si définis,
 * sinon liens par défaut (catégories racines publiées, Blog seulement s'il a des articles).
 * Coordonnées et réseaux sociaux : Filament (Coordonnées & réseaux), sinon valeurs par défaut.
 */
export function Footer({
  t,
  contact,
  socials,
  menus,
  categories = [],
  hasBlog = false,
  logoDark,
}: {
  t: Dict;
  contact: Contact;
  socials: SiteContent["socials"];
  menus: SiteContent["menus"];
  categories?: { path: string; label: string }[];
  hasBlog?: boolean;
  logoDark?: string | null;
}) {
  const shop: Menu = menus.footerShop ?? {
    title: t.footer.shop,
    items: [{ label: "Tous les produits", url: "/produits" }, ...categories.map((c) => ({ label: c.label, url: c.path })), { label: "Packs", url: "/packs" }],
  };
  const info: Menu = menus.footerInfo ?? {
    title: t.footer.info,
    items: [
      { label: t.v4.quote, url: "/devis" },
      { label: t.nav.delivery, url: "/livraison" },
      { label: "Service après-vente", url: "/sav" },
      { label: t.nav.contact, url: "/contact" },
      ...(hasBlog ? [{ label: "Blog", url: "/blog" }] : []),
    ],
  };
  const legal: MenuItem[] = menus.footerLegal?.items ?? [
    { label: t.footer.legal, url: "/livraison#mentions" },
    { label: "Confidentialité", url: "/livraison#confidentialite" },
  ];
  const wa = waHref(contact);

  return (
    <footer className="mt-24 bg-brand-deep text-brand-deep-fg lg:mt-32 [content-visibility:auto] [contain-intrinsic-size:auto_900px]">
      {/* bande d'action : 3 chemins (WhatsApp, devis, appel) */}
      <div className="shell">
        <div className="grid-12 items-end gap-y-8 border-b border-brand-deep-fg/15 py-14 lg:py-20">
          <div className="col-span-12 lg:col-span-7">
            <p className="eyebrow text-flame">WhatsApp · devis · téléphone</p>
            <h2 className="mt-4 max-w-[18ch] text-d2">{t.v2.footerCta.join(" ")}</h2>
            <p className="mt-4 max-w-md opacity-75">{t.home.waText}</p>
          </div>
          <div className="col-span-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:col-span-5 lg:justify-end">
            <a href={waHref(contact, "Bonjour FAW")} target="_blank" rel="noopener" className="btn btn-primary">
              <WhatsAppIcon className="size-[18px]" /> <span dir="ltr">{contact.whatsappDisplay}</span>
            </a>
            <Link href="/devis" className="btn border border-brand-deep-fg/30 hover:border-brand-deep-fg">{t.v4.quote}</Link>
            <a href={contact.phoneHref} className="btn border border-brand-deep-fg/30 hover:border-brand-deep-fg"><span dir="ltr">{contact.phone}</span></a>
          </div>
        </div>

        <div className="grid-12 gap-y-10 py-14 text-sm">
          <div className="col-span-12 lg:col-span-4">
            <Logo onDark className="h-9" sizes="126px" darkSrc={logoDark} />
            <p className="mt-4 max-w-xs opacity-75">Portes coupe-feu EI60, châssis galandage, matériel incendie et kit moteur portail, à Casablanca.</p>
            {socials.length > 0 && (
              <div className="mt-6">
                <h2 className="sr-only">{t.v4.social}</h2>
                <ul className="flex gap-2" data-testid="socials">
                  {socials.map((s) => (
                    <li key={s.key}>
                      <a href={s.url} target="_blank" rel="noopener me" aria-label={`FAW Aluminium sur ${SOCIAL_LABEL[s.key]}`} className="grid size-11 place-items-center rounded-full border border-brand-deep-fg/25 hover:border-flame hover:text-flame">
                        <SocialIcon k={s.key} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <Column id="f-shop" menu={shop} />
          <Column id="f-help" menu={info} />
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <h2 className="eyebrow opacity-60">Bureau</h2>
            <address className="mt-4 space-y-3 not-italic">
              <p>{contact.address}</p>
              <p className="flex gap-4">
                <a className="inline-flex min-h-8 items-center gap-0.5 hover:text-flame" href={contact.mapsUrl} target="_blank" rel="noopener">Maps <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></a>
                <a className="inline-flex min-h-8 items-center gap-0.5 hover:text-flame" href={contact.wazeUrl} target="_blank" rel="noopener">Waze <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></a>
              </p>
              <p><span className="opacity-60">Fixe · </span><a href={contact.phoneHref} dir="ltr" className="hover:text-flame">{contact.phone}</a></p>
              <p><span className="opacity-60">WhatsApp · </span><a href={wa} target="_blank" rel="noopener" dir="ltr" className="hover:text-flame">{contact.whatsappDisplay}</a></p>
              <p className="break-all"><a href={`mailto:${contact.email}`} className="hover:text-flame">{contact.email}</a></p>
              <p><span className="opacity-60">{t.footer.hours} · </span>{contact.hours}</p>
            </address>
          </div>
        </div>
      </div>

      {/* signature : mot-symbole géant, filet orange */}
      <div className="shell overflow-hidden" aria-hidden>
        <p className="select-none text-[clamp(5rem,22vw,20rem)] leading-[0.8] font-bold tracking-[-0.04em] text-transparent [-webkit-text-stroke:1px_rgb(251_243_232/0.18)]">FAW<span className="text-flame [-webkit-text-stroke:0]">.</span></p>
      </div>
      <div className="shell">
        <div className="flex flex-col gap-3 border-t border-brand-deep-fg/15 py-6 text-xs opacity-70 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} FAW Aluminium · {SITE.tagline} · {t.footer.rights}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legal.map((item) => (
              <li key={`${item.url}-${item.label}`}><FooterLink item={item} /></li>
            ))}
            <li><ConsentReset label="Gérer les cookies" /></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
