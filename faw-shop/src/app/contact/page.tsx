import {MessageForm} from "@/components/message-form";
import type { Metadata } from "next";
import { alternates } from "@/lib/seo";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { getDict } from "@/lib/i18n-server";
import { siteContent, waHref } from "@/lib/site-content";

export async function generateMetadata(): Promise<Metadata> {
  const { contact } = await siteContent();
  return {
    title: "Contact – FAW à Casablanca",
    description: `WhatsApp ${contact.whatsappDisplay} · Bureau : ${contact.address}. Itinéraire Google Maps et Waze.`,
    alternates: await alternates("/contact"),
  };
}

export default async function ContactPage() {
  const [{ t, locale }, { contact }] = await Promise.all([getDict(), siteContent()]);
  const waLink = (text?: string) => waHref(contact, text);
  return (
    <div className="shell pt-10 sm:pt-16">
      <p className="eyebrow text-copper">Casablanca</p>
      <h1 className="mt-3 text-d1">{t.contact.title}</h1>
      <p className="mt-3 text-muted-foreground">{t.contact.lead}</p>
      <div className="grid-12 mt-10 gap-y-4">
        <Reveal className="relative col-span-12 rounded-lg bg-sand p-8 sm:p-10 lg:col-span-6">
          <div className="relative">
            <WhatsAppIcon className="size-8 text-copper" />
            <p className="mt-6 text-d2 font-semibold tnum" dir="ltr">{contact.whatsappDisplay}</p>
            <a
              href={waLink(locale === "ar" ? "السلام عليكم FAW" : "Bonjour FAW")}
              target="_blank"
              rel="noopener"
              className="btn btn-primary mt-6"
            >
              <WhatsAppIcon className="size-4" /> {t.home.ctaWa}
            </a>
            <dl className="mt-10 grid gap-5 text-sm sm:grid-cols-2">
              <div>
                <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground"><Phone className="size-3.5" /> {t.contact.call}</dt>
                <dd className="mt-1" dir="ltr"><a href={contact.phoneHref} className="hover:underline">{contact.phone}</a></dd>
              </div>
              <div>
                <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground"><Mail className="size-3.5" /> E-mail</dt>
                <dd className="mt-1"><a href={`mailto:${contact.email}`} className="hover:underline">{contact.email}</a></dd>
              </div>
            </dl>
          </div>
        </Reveal>
        <Reveal className="col-span-12 flex flex-col rounded-lg border border-rule bg-card p-8 sm:p-10 lg:col-span-6">
          <p className="eyebrow flex items-center gap-1.5 text-copper"><MapPin className="size-3.5" /> Bureau</p>
          <p className="mt-3 text-d3 font-semibold">{contact.address}</p>
          <p className="mt-2 text-sm text-muted-foreground" data-testid="depot-address">Retrait gratuit au dépôt : {contact.depotAddress}</p>
          <dl className="mt-6 space-y-1 text-sm">
            <div className="flex gap-2"><dt className="text-muted-foreground">Fixe</dt><dd dir="ltr"><a className="hover:underline" href={contact.phoneHref}>{contact.phone}</a></dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground">WhatsApp</dt><dd dir="ltr"><a className="hover:underline" href={waLink()} target="_blank" rel="noopener">{contact.whatsappDisplay}</a></dd></div>
            <div className="flex gap-2"><dt className="text-muted-foreground">E-mail</dt><dd><a className="hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a></dd></div>
          </dl>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href={contact.mapsUrl} target="_blank" rel="noopener" className="btn btn-primary">{t.contact.maps}</a>
            <a href={contact.wazeUrl} target="_blank" rel="noopener" className="btn btn-ghost">{t.contact.waze}</a>
          </div>
          <div className="mt-auto pt-10">
            <p className="eyebrow flex items-center gap-1.5 text-muted-foreground"><Clock className="size-3.5" /> {t.footer.hours}</p>
            <p className="mt-1.5">{contact.hours}</p>
            <p className="mt-1 text-xs text-muted-foreground">Dimanche : à confirmer.</p>
          </div>
        </Reveal>
      </div>
      <div className="mt-12 max-w-3xl pb-12"><h2 className="text-d3">Écrire à l’équipe</h2><MessageForm/></div>
    </div>
  );
}
