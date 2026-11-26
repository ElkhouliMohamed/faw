import type { Metadata } from "next";
import { alternates } from "@/lib/seo";
import { getDict } from "@/lib/i18n-server";
import { SITE } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Livraison & conditions",
    description: "Livraison des portes coupe-feu à Casablanca et Rabat, retrait gratuit au dépôt, kit livré partout au Maroc. Transport et prix sur devis. Paiement par virement ou chèque.",
    alternates: await alternates("/livraison"),
  };
}

function Block({ id, n, title, children }: { id?: string; n: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="grid-12 scroll-mt-24 border-t border-rule py-10">
      <div className="col-span-12 md:col-span-4">
        <p className="eyebrow text-copper tnum">{n}</p>
        <h2 className="mt-2 text-d3">{title}</h2>
      </div>
      <div className="col-span-12 mt-4 space-y-3 text-muted-foreground md:col-span-8 md:mt-0 [&_li]:flex [&_li]:gap-2 [&_ul]:space-y-2">{children}</div>
    </section>
  );
}
const Dot = () => <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-copper" aria-hidden />;

export default async function DeliveryPage() {
  const { t, locale } = await getDict();
  return (
    <div className="shell pt-10 sm:pt-16">
      <p className="eyebrow text-copper">FAW Aluminium</p>
      <h1 className="mt-3 text-d1">{t.nav.delivery}</h1>
      {locale === "ar" && <p className="mt-3 text-sm text-muted-foreground">تفاصيل الشروط متوفرة بالفرنسية.</p>}
      <div className="mt-10" lang="fr" dir="ltr">
        <Block n="01" title="Livraison des portes coupe-feu">
          <ul>
            <li><Dot />Casablanca et Rabat : <strong>transport à confirmer sur devis</strong></li>
            <li><Dot />Autres villes : sur devis</li>
            <li><Dot />Retrait <strong>gratuit</strong> au dépôt : {SITE.depotAddress}</li>
            <li><Dot />Le transport est facturé une seule fois par commande.</li>
          </ul>
        </Block>
        <Block n="02" title="Kit moteur G-BAT 300">
          <ul>
            <li><Dot />Livraison partout au Maroc par transporteur.</li>
            <li><Dot />Frais de transport selon la ville, payés à la réception.</li>
            <li><Dot />Conditions de garantie à confirmer.</li>
          </ul>
        </Block>
        <Block n="03" title="Galandage et matériel incendie">
          <ul>
            <li><Dot />Livraison : sur devis.</li>
            <li><Dot />Retrait au dépôt : {SITE.depotAddress}.</li>
          </ul>
        </Block>
        <Block n="04" title="Délais">
          <p>FAW vous confirme la disponibilité lors de la confirmation de votre demande. Le délai est précisé sur le devis.</p>
        </Block>
        <Block n="05" title="Pose et installation">
          <p>La pose / l&apos;installation n&apos;est <strong>jamais incluse</strong> (portes coupe-feu, galandage, kit, matériel incendie).</p>
        </Block>
        <Block n="06" title="Sur-mesure">
          <ul>
            <li><Dot />Uniquement en grande quantité.</li>
            <li><Dot />Délai précisé sur le devis.</li>
            <li><Dot />Acompte de 50 % à la commande.</li>
          </ul>
        </Block>
        <Block n="07" title="Commande et paiement">
          <ul>
            <li><Dot />Le site enregistre une <strong>demande de commande</strong> : aucun paiement en ligne. FAW vous recontacte pour confirmer.</li>
            <li><Dot />Virement bancaire.</li>
            <li><Dot />Chèque : la marchandise est remise après encaissement.</li>
            <li><Dot />Kit G-BAT 300 commandé seul : paiement à la réception possible.</li>
            <li><Dot />Pas de crédit ni de paiement échelonné.</li>
            <li><Dot />Les prix et le transport sont communiqués sur devis, valable 14 jours.</li>
          </ul>
        </Block>
        <Block n="08" title="Garanties et certificats">
          <ul>
            <li><Dot />Kit G-BAT 300 : conditions de garantie à confirmer.</li>
            <li><Dot />Portes coupe-feu EI60 : certificats de résistance au feu et de conformité disponibles sur demande.</li>
          </ul>
        </Block>
        <Block n="09" title="Retours et remboursements">
          <p>Pour toute question sur un retour ou un remboursement, contactez FAW : la demande est étudiée au cas par cas.</p>
        </Block>
        <Block n="10" title="Visuels">
          <p>Les visuels marqués « illustration non contractuelle » ne sont pas des photos du produit livré. Sur les illustrations de portes, la barre anti-panique et le ferme-porte sont des options payantes.</p>
        </Block>
        <Block id="devis" n="11" title="Devis en ligne">
          <ul>
            <li><Dot />Le formulaire de devis enregistre votre demande ; l&apos;équipe FAW la valide puis vous envoie le devis PDF numéroté, valable 14 jours, avec les totaux HT et TTC (TVA 20 %).</li>
            <li><Dot />Fourniture seule : installation non incluse. Transport en ligne optionnelle, hors total.</li>
            <li><Dot />Paiement par virement ou chèque. Pas de crédit ni de financement.</li>
            <li><Dot />Sur-mesure, prix ou stock à confirmer : votre demande est transmise à l&apos;équipe FAW, qui vous recontacte.</li>
          </ul>
        </Block>
        <Block id="confidentialite" n="12" title="Données personnelles et cookies">
          <ul>
            <li><Dot />Les informations saisies (nom, téléphone, ville, e-mail, raison sociale, ICE) servent uniquement à traiter votre commande ou votre devis.</li>
            <li><Dot />Le panier, la langue et votre choix de cookies sont conservés dans votre navigateur.</li>
            <li><Dot />Mesure d&apos;audience (Google Analytics, pixel Meta) : chargée uniquement si vous cliquez sur « Accepter ». Vous pouvez changer d&apos;avis via « Gérer les cookies » en bas de page.</li>
          </ul>
        </Block>
        <Block id="mentions" n="13" title="Mentions légales">
          <p>FAW Aluminium · {SITE.address} · {SITE.email} · <span dir="ltr">{SITE.phone}</span></p>
        </Block>
      </div>
    </div>
  );
}
