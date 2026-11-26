import type {PublicConfig} from "@/lib/public-config";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WhatsAppIcon,SocialIcon } from "./icons";
import { Logo } from "./logo";
import { SITE, socialLinks, waLink } from "@/lib/site";
import { ConsentReset } from "./consent";
import type { Dict } from "@/lib/i18n";

/** Liens de catégories = catégories racines publiées ; Blog seulement s'il a des articles publiés. */
export function Footer({ t, socialConfig, categories = [], hasBlog = false }: { t: Dict; socialConfig?:PublicConfig["social"]; categories?: { path: string; label: string }[]; hasBlog?: boolean }) {
  const defaults=socialLinks();
  const socials=(["instagram","linkedin","facebook"] as const).flatMap(key=>{const url=socialConfig?.[key] || defaults.find(s=>s.key===key)?.url;return url?[{key,label:key==="instagram"?"Instagram":key==="linkedin"?"LinkedIn":"Facebook",url}]:[];});
  return (
    <footer className="mt-24 bg-brand-deep text-brand-deep-fg lg:mt-32">
      {/* bande d'action : 3 chemins (WhatsApp, devis, appel) */}
      <div className="shell">
        <div className="grid-12 items-end gap-y-8 border-b border-brand-deep-fg/15 py-14 lg:py-20">
          <div className="col-span-12 lg:col-span-7">
            <p className="eyebrow text-flame">WhatsApp · devis · téléphone</p>
            <h2 className="mt-4 max-w-[18ch] text-d2">{t.v2.footerCta.join(" ")}</h2>
            <p className="mt-4 max-w-md opacity-75">{t.home.waText}</p>
          </div>
          <div className="col-span-12 flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <a href={waLink("Bonjour FAW")} target="_blank" rel="noopener" className="btn btn-primary">
              <WhatsAppIcon className="size-[18px]" /> <span dir="ltr">{SITE.whatsappDisplay}</span>
            </a>
            <Link href="/devis" className="btn border border-brand-deep-fg/30 hover:border-brand-deep-fg">{t.v4.quote}</Link>
            <a href={SITE.phoneHref} className="btn border border-brand-deep-fg/30 hover:border-brand-deep-fg"><span dir="ltr">{SITE.phone}</span></a>
          </div>
        </div>

        <div className="grid-12 gap-y-10 py-14 text-sm">
          <div className="col-span-12 lg:col-span-4">
            <Logo onDark className="h-9" />
            <p className="mt-4 max-w-xs opacity-75">Portes coupe-feu EI60, châssis galandage, matériel incendie et kit moteur portail, à Casablanca.</p>
            {socials.length > 0 && (
              <div className="mt-6">
                <h2 className="sr-only">{t.v4.social}</h2>
                <ul className="flex gap-2" data-testid="socials">
                  {socials.map((s) => (
                    <li key={s.key}>
                      <a href={s.url} target="_blank" rel="noopener me" aria-label={`FAW Aluminium sur ${s.label}`} className="grid size-11 place-items-center rounded-full border border-brand-deep-fg/25 hover:border-flame hover:text-flame">
                        <SocialIcon k={s.key} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <nav className="col-span-6 lg:col-span-2" aria-labelledby="f-shop">
            <h2 id="f-shop" className="eyebrow opacity-60">{t.footer.shop}</h2>
            <ul className="mt-4 space-y-3">
              <li><Link className="hover:text-flame" href="/produits">Tous les produits</Link></li>
              {categories.map((c) => (
                <li key={c.path}><Link className="hover:text-flame" href={c.path}>{c.label}</Link></li>
              ))}
              <li><Link className="hover:text-flame" href="/packs">Packs</Link></li>
            </ul>
          </nav>
          <nav className="col-span-6 lg:col-span-2" aria-labelledby="f-help">
            <h2 id="f-help" className="eyebrow opacity-60">{t.footer.info}</h2>
            <ul className="mt-4 space-y-3">
              <li><Link className="hover:text-flame" href="/devis">{t.v4.quote}</Link></li>
              <li><Link className="hover:text-flame" href="/livraison">{t.nav.delivery}</Link></li>
              <li><Link className="hover:text-flame" href="/sav">Service après-vente</Link></li>
              <li><Link className="hover:text-flame" href="/contact">{t.nav.contact}</Link></li>
              {hasBlog && <li><Link className="hover:text-flame" href="/blog">Blog</Link></li>}
            </ul>
          </nav>
          <div className="col-span-12 sm:col-span-6 lg:col-span-4">
            <h2 className="eyebrow opacity-60">Bureau</h2>
            <address className="mt-4 space-y-3 not-italic">
              <p>{SITE.address}</p>
              <p className="flex gap-4">
                <a className="inline-flex items-center gap-0.5 hover:text-flame" href={SITE.mapsUrl} target="_blank" rel="noopener">Maps <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></a>
                <a className="inline-flex items-center gap-0.5 hover:text-flame" href={SITE.wazeUrl} target="_blank" rel="noopener">Waze <ArrowUpRight className="size-3.5 rtl:-scale-x-100" /></a>
              </p>
              <p><span className="opacity-60">Fixe · </span><a href={SITE.phoneHref} dir="ltr" className="hover:text-flame">{SITE.phone}</a></p>
              <p><span className="opacity-60">WhatsApp · </span><a href={waLink()} target="_blank" rel="noopener" dir="ltr" className="hover:text-flame">{SITE.whatsappDisplay}</a></p>
              <p className="break-all"><a href={`mailto:${SITE.email}`} className="hover:text-flame">{SITE.email}</a></p>
              <p><span className="opacity-60">{t.footer.hours} · </span>{SITE.hours}</p>
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
            <li><Link className="hover:text-flame" href="/livraison#mentions">{t.footer.legal}</Link></li>
            <li><Link className="hover:text-flame" href="/livraison#confidentialite">Confidentialité</Link></li>
            <li><ConsentReset label="Gérer les cookies" /></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
