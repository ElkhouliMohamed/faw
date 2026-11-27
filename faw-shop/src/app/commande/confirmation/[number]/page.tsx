import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { shopOrder } from "@/lib/shop-api";
import { getDict } from "@/lib/i18n-server";
import { formatDH } from "@/lib/format";
import { waLink } from "@/lib/site";
import { FR_DELIVERY_LABEL, FR_PAYMENT_LABEL, type DeliveryMode, type PaymentMethod } from "@/lib/delivery";
import { WhatsAppIcon } from "@/components/icons";
import { ClearCart } from "./clear-cart";
import { Steps } from "@/components/steps";

export const metadata: Metadata = { title: "Demande reçue", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function Confirmation({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const { number } = await params;
  const { nouveau } = await searchParams;
  // Lu par l'API Laravel : numéro aléatoire complet uniquement, commande récente, aucune autre donnée client.
  const order = await shopOrder(number);
  if (!order) notFound();
  const { t, locale } = await getDict();
  const dm = order.deliveryMode as DeliveryMode;
  const pm = order.paymentMethod as PaymentMethod;
  const feeLabel = order.deliveryFee > 0 ? formatDH(order.deliveryFee) : dm === "retrait" ? "Gratuit" : dm === "transporteur" ? "payés à la réception" : "sur devis";

  const summary = [
    `Bonjour FAW, voici ma demande de commande ${order.number} :`,
    ...order.items.map((i) => `- ${i.quantity} × ${i.title} (${i.productId}) : ${formatDH(i.lineTotal)}`),
    `Livraison : ${FR_DELIVERY_LABEL[dm]} (${feeLabel})`,
    `Paiement : ${FR_PAYMENT_LABEL[pm]}`,
    `Total : ${formatDH(order.total)}`,
    `Nom : ${order.customerName} · ${order.city}`,
  ].join("\n");

  return (
    <div className="mx-auto max-w-3xl px-4 pt-12 sm:px-6 sm:pt-16">
      <div className="mb-8"><Steps current={2} /></div>
      {nouveau && <ClearCart orderNumber={order.number} total={order.total} />}
      <div className="rounded-lg bg-sand p-6 sm:p-10" data-testid="confirmation">
        <CheckCircle2 className="size-10 text-[#3d6b3a] dark:text-[#9cc497]" strokeWidth={1.5} />
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">{t.confirm.title}</h1>
        <p className="mt-3 text-muted-foreground">{t.confirm.lead}</p>
        <div className="mt-6 inline-flex max-w-full flex-col rounded-lg border border-rule bg-card px-4 py-3">
          <span className="eyebrow text-muted-foreground">{t.confirm.number}</span>
          <span className="min-w-0 break-all font-mono text-sm font-semibold text-price sm:text-xl" dir="ltr" data-testid="order-number">{order.number}</span>
        </div>

        <ul className="mt-8 divide-y divide-rule rounded-lg border border-rule bg-card text-sm" lang="fr" dir="ltr">
          {order.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 px-4 py-3">
              <span><span className="font-mono text-xs text-muted-foreground">{i.quantity}×</span> {i.title}</span>
              <span className="shrink-0">{formatDH(i.lineTotal)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 px-4 py-3 text-muted-foreground">
            <span>{FR_DELIVERY_LABEL[dm]}</span>
            <span className="shrink-0">{feeLabel}</span>
          </li>
          <li className="flex justify-between gap-4 px-4 py-3 text-muted-foreground">
            <span>Paiement</span>
            <span className="shrink-0">{FR_PAYMENT_LABEL[pm]}</span>
          </li>
          <li className="flex items-baseline justify-between gap-4 px-4 py-3">
            <span className="font-semibold">Total TTC</span>
            <span className="text-xl font-semibold tnum text-price">{formatDH(order.total)}</span>
          </li>
        </ul>
        {order.deliveryNote && <p className="mt-3 text-xs text-muted-foreground" lang="fr">{order.deliveryNote}</p>}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <a
            href={waLink(summary)}
            target="_blank"
            rel="noopener"
            data-testid="wa-confirmation"
            className="btn btn-primary"
          >
            <WhatsAppIcon className="size-[18px]" /> {t.confirm.wa}
          </a>
          <Link href="/produits" className="btn btn-ghost">
            {t.confirm.back}
          </Link>
        </div>
        {locale === "ar" && <p className="mt-4 text-xs text-muted-foreground">الملخص يرسل بالفرنسية.</p>}
      </div>
    </div>
  );
}
