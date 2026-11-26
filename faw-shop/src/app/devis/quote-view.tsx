import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, Download, FileText, Lock } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { findQuoteByToken } from "@/lib/quote-token";
import { fmtDateTime } from "@/lib/crm";
import { formatDH, stripPriceMentions } from "@/lib/format";
import { privateLink, publicBaseUrl } from "@/lib/quote-email";
import { warrantiesForIds } from "@/lib/merch";
import { waLink } from "@/lib/site";
import { CopyLink } from "./copy-link";
import { QuoteLead } from "@/components/tracking";
import { getLocale } from "@/lib/i18n-server";
import { getPortal } from "@/lib/portal";
import { PortalView } from "./portal/portal-view";
import { PortalOrderView } from "./portal/portal-order";

type Line = { id: string; title: string; qty: number; unit: number; total: number; tier?: boolean };

import { QUOTE_TOKEN_RE as TOKEN_RE } from "@/lib/devis";

/** Page client d'un devis, accessible uniquement par son jeton privé. Débloquée dès la validation par l'équipe. */
export async function QuoteView({ token, mode }: { token: string; mode: "confirmation" | "suivi" }) {
  if (!TOKEN_RE.test(token)) notFound();
  const q = await findQuoteByToken(token);
  if (!q) notFound();
  let lines: Line[] = [];
  try {
    lines = JSON.parse(q.lines);
  } catch {}
  const warranties = await warrantiesForIds(lines.map((l) => l.id)).catch(() => []);
  const ready = (q.status === "validé" || q.status === "envoyé") && !!q.pdfFile && !!q.number;
  const refused = q.status === "refusé";
  const link = privateLink(await publicBaseUrl(), token);
  const pdf = `/devis/pdf/${token}`;
  const wa = waLink(
    ready ? `Bonjour Walfar, j'ai bien reçu le devis N° ${q.versionNumber ?? q.number}. Je souhaite le confirmer.` : `Bonjour Walfar, je viens d'envoyer une demande de devis sur le site au nom de ${q.clientName}.`,
  );
  const state = ready ? "valide" : refused ? "refuse" : "en-cours";
  if (ready) {
    // Portail client (version courante, décision) servi par Laravel ; repli sur la vue simple si l'API est indisponible.
    const portal = await getPortal(token);
    if (portal?.version) {
      const locale = await getLocale();
      return (
        <PortalView token={token} locale={locale} state={portal} link={link} wa={wa}>
          {portal.order && <PortalOrderView token={token} locale={locale} order={portal.order} />}
        </PortalView>
      );
    }
  }
  return (
    <div className="shell max-w-3xl pt-12 pb-6 sm:pt-16" data-testid="quote-suivi" data-state={state}>
      {mode === "confirmation" && !ready && !refused ? <QuoteLead token={token} /> : null}
      {ready ? <CheckCircle2 className="size-9 text-copper" aria-hidden /> : <Clock className="size-9 text-copper" aria-hidden />}
      {ready ? (
        <>
          <p className="eyebrow mt-4">Devis N° <span data-testid="quote-number">{q.versionNumber ?? q.number}</span></p>
          <h1 className="mt-2 text-d2">Votre devis est prêt</h1>
          <p className="mt-3 text-lg">Validé par l&apos;équipe FAW. Total TTC : <strong className="tnum" data-testid="quote-total-head">{formatDH(q.totalTtc)}</strong>.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={`${pdf}?dl=1`} className="btn btn-primary" data-testid="quote-download" download>
              <Download className="size-4" aria-hidden /> Télécharger le PDF
            </a>
            <a href={pdf} target="_blank" rel="noopener" className="btn btn-ghost" data-testid="quote-open">
              <FileText className="size-4" aria-hidden /> Ouvrir le devis
            </a>
          </div>
        </>
      ) : refused ? (
        <>
          <h1 className="mt-4 text-d2">Demande non retenue</h1>
          <p className="mt-3 text-lg" data-testid="quote-refused">Cette demande n&apos;a pas donné lieu à un devis. Écrivez-nous sur WhatsApp, l&apos;équipe FAW vous répond.</p>
        </>
      ) : (
        <>
          <h1 className="mt-4 text-d2">{mode === "confirmation" ? "Demande reçue" : "Demande en cours de validation"}</h1>
          <p className="mt-3 text-lg" data-testid="quote-pending">Votre demande de devis est enregistrée, notre équipe la vérifie avant de vous envoyer le devis.</p>
          <p className="mt-2 text-sm text-muted-foreground">Demande du {fmtDateTime.format(q.createdAt)} (heure du Maroc) au nom de <strong className="text-foreground">{q.clientName}</strong>.</p>
        </>
      )}

      <section className="mt-8 rounded-2xl border border-rule p-5" aria-labelledby="lien-prive" data-testid="quote-private">
        <h2 id="lien-prive" className="flex items-center gap-2 text-base font-semibold"><Lock className="size-4" aria-hidden /> Votre lien privé</h2>
        <p className="mt-1 text-sm text-muted-foreground" data-testid="quote-keep-link">
          {ready
            ? "Conservez ce lien : il donne accès à votre devis. Ne le partagez qu'avec les personnes concernées."
            : "Conservez ce lien : dès que l'équipe a validé votre devis, il s'affiche ici avec le PDF. Ne le partagez qu'avec les personnes concernées."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} aria-label="Lien privé de votre devis" className="h-11 w-full min-w-0 rounded-lg border border-rule bg-background px-3 font-mono text-xs" data-testid="quote-private-link" />
          <CopyLink text={link} />
        </div>
      </section>

      <div className="mt-10 overflow-hidden rounded-2xl border border-rule">
        <table className="w-full text-sm">
          <caption className="sr-only">{ready ? "Détail du devis" : "Produits demandés"}</caption>
          <thead className="bg-sand text-start">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">Produit</th>
              <th scope="col" className="px-2 py-3 text-end font-semibold">Qté</th>
              {ready && <th scope="col" className="px-4 py-3 text-end font-semibold">Total TTC</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-rule">
                <td className="px-4 py-3">
                  {l.title}
                  {ready && <span className="block text-xs text-muted-foreground">{formatDH(l.unit)} TTC l&apos;unité{l.tier ? " (tarif dès 4 portes)" : ""}</span>}
                </td>
                <td className="px-2 py-3 text-end tnum">{l.qty}</td>
                {ready && <td className="px-4 py-3 text-end tnum">{formatDH(l.total)}</td>}
              </tr>
            ))}
          </tbody>
          {ready && (
            <tfoot className="border-t border-rule">
              <tr><td colSpan={2} className="px-4 pt-3 text-muted-foreground">Total HT</td><td className="px-4 pt-3 text-end tnum">{formatDH(Math.round(q.totalHt))}</td></tr>
              <tr><td colSpan={2} className="px-4 text-muted-foreground">TVA 20 %</td><td className="px-4 text-end tnum">{formatDH(Math.round(q.totalTtc - q.totalHt))}</td></tr>
              <tr className="font-semibold"><td colSpan={2} className="px-4 pb-3">Total TTC</td><td className="px-4 pb-3 text-end tnum" data-testid="quote-total">{formatDH(q.totalTtc)}</td></tr>
            </tfoot>
          )}
        </table>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        <li>Transport : {ready ? q.transport : stripPriceMentions(q.transport) || q.transport}.</li>
        <li>Fourniture seule, pose non comprise.</li>
        <li>Règlement par virement ou chèque.</li>
      </ul>
      {warranties.length > 0 && (
        <div className="mt-4 space-y-2 text-sm" data-testid="quote-warranty">
          {warranties.map((w) => (
            <p key={w.name}><strong className="font-semibold">{w.name}</strong> : <span className="whitespace-pre-line text-muted-foreground">{w.text}</span></p>
          ))}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-rule bg-sand p-5 sm:p-6">
        <h2 className="text-lg font-semibold">{ready ? "Pour confirmer" : "Une question ?"}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready ? "Répondez-nous sur WhatsApp avec le numéro du devis : l'équipe FAW confirme la disponibilité et le transport." : "Vous pouvez nous écrire directement sur WhatsApp."}
        </p>
        <a href={wa} target="_blank" rel="noopener" className="btn btn-primary mt-4" data-testid="quote-confirm-wa">
          <WhatsAppIcon className="size-4" /> {ready ? "Confirmer sur WhatsApp" : "Écrire sur WhatsApp"}
        </a>
      </div>
      <p className="mt-8 text-sm"><Link href="/produits" className="underline underline-offset-4">Continuer mes achats</Link></p>
    </div>
  );
}
