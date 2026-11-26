import { Landmark } from "lucide-react";
import { formatDH } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { PORTAL_DICTS } from "@/lib/portal-i18n";
import type { PortalPayment } from "@/lib/portal";
import { PortalProof } from "./portal-proof";

/** Paiement par virement sur le lien privé : montants de la commande du client, RIB uniquement s'il est configuré. Pas de carte. */
export function PortalPaymentView({ token, locale, payment }: { token: string; locale: Locale; payment: PortalPayment }) {
  const t = PORTAL_DICTS[locale];
  const b = payment.bank;
  return (
    <div className="mt-5 rounded-xl bg-sand p-4" data-testid="portal-payment">
      <h3 className="flex items-center gap-2 font-semibold"><Landmark className="size-4 text-copper" aria-hidden />{t.payTitle}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t.payLead}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div><dt className="text-muted-foreground">{t.payDue}</dt><dd className="font-semibold" dir="ltr" data-testid="portal-due">{formatDH(payment.due)}</dd></div>
        <div><dt className="text-muted-foreground">{t.payPaid}</dt><dd dir="ltr">{formatDH(payment.paid)}</dd></div>
      </dl>
      <dl className="mt-3 space-y-1 text-sm" data-testid="portal-bank">
        <div><dt className="inline text-muted-foreground">{t.rib} : </dt><dd className="inline font-mono" dir={b.rib ? "ltr" : undefined}>{b.rib || t.ribPending}</dd></div>
        {b.iban && <div><dt className="inline text-muted-foreground">IBAN : </dt><dd className="inline font-mono" dir="ltr">{b.iban}</dd></div>}
        {b.holder && <div><dt className="inline text-muted-foreground">{t.holder} : </dt><dd className="inline">{b.holder}</dd></div>}
        {b.bankName && <div><dt className="inline text-muted-foreground">{t.bankName} : </dt><dd className="inline">{b.bankName}</dd></div>}
        {b.branch && <div><dt className="inline text-muted-foreground">{t.branch} : </dt><dd className="inline">{b.branch}</dd></div>}
        {b.swift && <div><dt className="inline text-muted-foreground">{t.swift} : </dt><dd className="inline font-mono" dir="ltr">{b.swift}</dd></div>}
      </dl>
      <ul className="mt-4 space-y-3">
        {payment.payments.map((p) => (
          <li key={p.id} className="rounded-lg border border-rule bg-white p-3" data-testid={`portal-pay-${p.id}`} data-status={p.status}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">{p.label}</span>
              <span className="font-semibold" dir="ltr">{formatDH(p.amount)}</span>
            </div>
            <p className="mt-1 text-sm">{t.payRef} : <span className="font-mono whitespace-nowrap" dir="ltr">{p.reference}</span></p>
            <p className="mt-1 text-xs text-muted-foreground">{t.payStatuses[p.status] || p.status}</p>
            {p.canUploadProof && <PortalProof token={token} locale={locale} paymentId={p.id} maxBytes={payment.proofRules.maxBytes} />}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{t.cardOff}</p>
    </div>
  );
}
