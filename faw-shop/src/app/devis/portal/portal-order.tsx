import { MapPin, Package, Truck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { PORTAL_DICTS } from "@/lib/portal-i18n";
import type { PortalOrder } from "@/lib/portal";
import { PortalPaymentView } from "./portal-payment";

const dt = (s: string | null | undefined) =>
  s ? new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" }).format(new Date(s)) : "";

/** Suivi de commande sur le lien privé. Adresse de retrait : uniquement celle configurée par FAW, sinon « adresse communiquée par FAW ». */
export function PortalOrderView({ token, locale, order }: { token: string; locale: Locale; order: PortalOrder }) {
  const t = PORTAL_DICTS[locale];
  const label = (s: string) => t.orderStatuses[s] || s;
  return (
    <section className="mt-6 rounded-2xl border border-rule p-5" data-testid="portal-order" data-status={order.status}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold"><Package className="size-5 text-copper" aria-hidden />{t.orderTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.orderRef} : <span dir="ltr" className="font-mono whitespace-nowrap text-foreground" data-testid="portal-order-ref">{order.reference}</span></p>
        </div>
        <span className="self-start shrink-0 rounded-full bg-copper/10 px-3 py-1 text-xs font-semibold text-copper" data-testid="portal-order-status">{label(order.status)}</span>
      </div>
      <div className="mt-4 flex items-start gap-2 text-sm">
        {order.fulfilment === "retrait" ? <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> : <Truck className="mt-0.5 size-4 shrink-0" aria-hidden />}
        {order.fulfilment === "retrait" ? (
          <p data-testid="portal-pickup"><span className="font-medium">{t.pickupAddress}</span> : {order.pickupAddress || t.pickupPending}</p>
        ) : (
          <p>{t.fulfilment.livraison}{order.deliveryCity ? ` — ${t.deliveryTo} ${order.deliveryCity}` : ""}</p>
        )}
      </div>
      {order.payment && order.payment.payments.length > 0 && order.status !== "annule" && <PortalPaymentView token={token} locale={locale} payment={order.payment} />}
      {order.history.length > 0 && (
        <div className="mt-4 text-sm">
          <h3 className="font-semibold">{t.orderSteps}</h3>
          <ol className="mt-2 space-y-1 border-s-2 border-rule ps-3 text-muted-foreground" data-testid="portal-order-history">
            {order.history.map((h, i) => <li key={i}><span dir="ltr">{dt(h.at)}</span> — {label(h.status)}</li>)}
          </ol>
        </div>
      )}
    </section>
  );
}
