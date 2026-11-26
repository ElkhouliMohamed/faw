import { CheckCircle2, Clock, Download, FileText, Lock } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { formatDH } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { PORTAL_DICTS } from "@/lib/portal-i18n";
import type { PortalState } from "@/lib/portal";
import { CopyLink } from "../copy-link";
import { PortalActions } from "./portal-actions";

const ymd = (s: string | null | undefined) => (s ? s.slice(0, 10).split("-").reverse().join("/") : "");
const dt = (s: string | null | undefined) =>
  s ? new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(s)) : "";

/** Portail client d'un devis validé : version courante, PDF, validité, conditions, décision. FR + AR, mobile d'abord. */
export function PortalView({ token, locale, state, link, wa, children }: { token: string; locale: Locale; state: PortalState; link: string; wa: string; children?: React.ReactNode }) {
  const t = PORTAL_DICTS[locale];
  const v = state.version!;
  const pdf = `/devis/pdf/${token}`;
  const accepted = state.accepted;
  return (
    <div className="shell max-w-3xl pt-10 pb-6 sm:pt-16" data-testid="quote-suivi" data-state={accepted ? "accepte" : "valide"} data-portal>
      {accepted ? <CheckCircle2 className="size-9 text-copper" aria-hidden /> : v.expired ? <Clock className="size-9 text-copper" aria-hidden /> : <CheckCircle2 className="size-9 text-copper" aria-hidden />}
      <p className="eyebrow mt-4">{t.quoteNo} <span data-testid="quote-number" dir="ltr">{v.number}</span></p>
      <h1 className="mt-2 text-d2">{accepted ? t.acceptedTitle : t.ready}</h1>
      <p className="mt-3 text-lg">{t.readyLead} {t.totalTtc} : <strong className="tnum" data-testid="quote-total-head" dir="ltr">{formatDH(v.totals.total_ttc)}</strong>.</p>
      <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
        <li data-testid="portal-valid-until">{t.validUntil} <strong className="text-foreground" dir="ltr">{ymd(v.validUntil)}</strong></li>
        {state.quote.linkExpiresAt && <li>{t.linkUntil} <span dir="ltr">{dt(state.quote.linkExpiresAt)}</span></li>}
      </ul>
      {v.expired && !accepted && <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" data-testid="portal-expired">{t.expired}</p>}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a href={`${pdf}?dl=1`} className="btn btn-primary" data-testid="quote-download" download><Download className="size-4" aria-hidden /> {t.download}</a>
        <a href={pdf} target="_blank" rel="noopener" className="btn btn-ghost" data-testid="quote-open"><FileText className="size-4" aria-hidden /> {t.open}</a>
      </div>

      {accepted && (
        <section className="mt-8 rounded-2xl border border-green-300 bg-green-50 p-5 text-green-900" data-testid="portal-accepted">
          <p className="font-semibold">{t.acceptedTitle}</p>
          <p className="mt-1 text-sm">{t.acceptedText(accepted.versionNumber, dt(accepted.at))}</p>
        </section>
      )}
      {children}

      <div className="mt-8 overflow-hidden rounded-2xl border border-rule">
        <table className="w-full text-sm">
          <caption className="sr-only">{t.quoteNo} {v.number}</caption>
          <thead className="bg-sand">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold">{t.product}</th>
              <th scope="col" className="px-2 py-3 text-end font-semibold">{t.qty}</th>
              <th scope="col" className="px-4 py-3 text-end font-semibold">{t.totalTtc}</th>
            </tr>
          </thead>
          <tbody>
            {v.lines.map((l, i) => (
              <tr key={`${l.reference}-${i}`} className="border-t border-rule">
                <td className="px-4 py-3">{l.name}<span className="block text-xs text-muted-foreground" dir="ltr">{formatDH(l.unitTtc)} · {t.unit}</span></td>
                <td className="px-2 py-3 text-end tnum">{l.qty}</td>
                <td className="px-4 py-3 text-end tnum" dir="ltr">{formatDH(l.totalTtc)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-rule">
            <tr><td colSpan={2} className="px-4 pt-3 text-muted-foreground">{t.totalHt}</td><td className="px-4 pt-3 text-end tnum" dir="ltr">{formatDH(Math.round(v.totals.total_ht), false)}</td></tr>
            <tr><td colSpan={2} className="px-4 text-muted-foreground">{t.vat}</td><td className="px-4 text-end tnum" dir="ltr">{formatDH(Math.round(v.totals.tax_amount), false)}</td></tr>
            <tr className="font-semibold"><td colSpan={2} className="px-4 pb-3">{t.totalTtc}</td><td className="px-4 pb-3 text-end tnum" data-testid="quote-total" dir="ltr">{formatDH(v.totals.total_ttc)}</td></tr>
          </tfoot>
        </table>
      </div>

      <section className="mt-6 text-sm" data-testid="portal-conditions">
        <p><strong className="font-semibold">{t.delivery} :</strong> {v.delivery.label}</p>
        <h2 className="mt-4 font-semibold">{t.conditions}</h2>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground" lang="fr" dir="ltr">
          {v.conditions.map((c) => <li key={c}>{c}</li>)}
        </ul>
      </section>

      {!accepted && (
        <PortalActions token={token} locale={locale} versionId={v.id} number={v.number} total={formatDH(v.totals.total_ttc)} validUntil={ymd(v.validUntil)}
          canAccept={state.actions.canAccept} acceptBlock={state.actions.acceptBlock} canRefuse={state.actions.canRefuse} canRequestChange={state.actions.canRequestChange} emailMasked={state.actions.emailMasked} />
      )}
      {!accepted && state.quote.customerDecision === "modification demandée" && <p className="mt-3 text-sm text-muted-foreground" data-testid="portal-change-pending">{t.changeText}</p>}
      {!accepted && state.quote.customerDecision === "refusé" && <p className="mt-3 text-sm text-muted-foreground">{t.refusedText}</p>}

      {state.history.length > 0 && (
        <section className="mt-8 text-sm" data-testid="portal-history">
          <h2 className="font-semibold">{t.history}</h2>
          <ul className="mt-2 space-y-1 text-muted-foreground">
            {state.history.map((h, i) => <li key={i}><span dir="ltr">{dt(h.at)}</span> — {t.decisions[h.decision] || h.decision} (<span dir="ltr">{h.versionNumber}</span>)</li>)}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-rule p-5" aria-labelledby="lien-prive" data-testid="quote-private">
        <h2 id="lien-prive" className="flex items-center gap-2 text-base font-semibold"><Lock className="size-4" aria-hidden /> {locale === "ar" ? "رابطكم الخاص" : "Votre lien privé"}</h2>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} aria-label="Lien privé" className="h-11 w-full min-w-0 rounded-lg border border-rule bg-background px-3 font-mono text-xs" dir="ltr" data-testid="quote-private-link" />
          <CopyLink text={link} />
        </div>
      </section>
      <a href={wa} target="_blank" rel="noopener" className="btn btn-ghost mt-6 h-auto! min-h-12 w-full py-3 text-center leading-snug whitespace-normal! sm:w-auto" data-testid="quote-confirm-wa"><WhatsAppIcon className="size-4" /> {t.whatsapp}</a>
    </div>
  );
}
