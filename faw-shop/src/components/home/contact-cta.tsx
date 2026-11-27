import { FileText, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { formatMoroccanNumber, type HomeSectionOf } from "@/lib/site-content";
import { BandBackground } from "./highlights";
import { SmartLink } from "./ui";

export type CtaContact = { phone: string; phoneHref: string; whatsappNumber: string };

/**
 * Bandeau d'appel à action brun arrondi : titre + texte, bouton téléphone blanc, bouton WhatsApp vert, bouton devis facultatif.
 * Numéros : ceux de la section, sinon les coordonnées du site.
 */
export function ContactCtaSection({ s, contact, waMessage, index }: { s: HomeSectionOf<"cta">; contact: CtaContact; waMessage: string; index: number }) {
  const id = `home-cta-${index}`;
  const phone = s.phone || contact.phone;
  const phoneHref = s.phone ? `tel:${s.phone.replace(/[^\d+]/g, "")}` : contact.phoneHref;
  const wa = /^\d{8,20}$/.test(s.whatsappNumber) ? s.whatsappNumber : contact.whatsappNumber;
  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(waMessage)}`;
  return (
    <section className="shell pt-16 lg:pt-24" aria-labelledby={id} data-section="cta">
      <div className="relative isolate overflow-hidden rounded-2xl bg-bark px-6 py-9 text-bark-fg shadow-soft sm:px-10 lg:px-12 lg:py-10">
        <BandBackground image={s.backgroundImage} />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <h2 id={id} className="text-[clamp(1.4rem,1.15rem+1vw,1.9rem)] leading-tight font-bold">{s.title}</h2>
            {s.text && <p className="mt-2 text-[0.9375rem] leading-relaxed opacity-80">{s.text}</p>}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:shrink-0 lg:border-s lg:border-bark-fg/20 lg:ps-10">
            {s.showPhone && (
              <a href={phoneHref} className="btn h-13 rounded-xl bg-white px-6 text-[0.9375rem] text-[#3a2416] shadow-soft hover:bg-white/90" data-testid="cta-phone">
                <Phone className="size-[18px] text-flame" aria-hidden />
                {s.phoneLabel ? s.phoneLabel : <span dir="ltr">{phone}</span>}
              </a>
            )}
            {s.showWhatsapp && (
              <a href={waHref} target="_blank" rel="noopener" className="btn h-13 rounded-xl bg-wa px-6 text-[0.9375rem] text-white shadow-soft hover:brightness-110" data-testid="cta-whatsapp">
                <WhatsAppIcon className="size-[18px]" />
                {s.whatsappLabel ? s.whatsappLabel : <span dir="ltr">{formatMoroccanNumber(wa)}</span>}
              </a>
            )}
            {s.label && s.url && (
              <SmartLink href={s.url} className="btn btn-primary h-13 rounded-xl px-6 text-[0.9375rem]" testid="home-quote">
                <FileText className="size-[18px]" aria-hidden /> {s.label}
              </SmartLink>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
