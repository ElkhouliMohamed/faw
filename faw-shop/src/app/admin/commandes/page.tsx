import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageAccess } from "@/lib/admin/perm";
import { updateLeadStatusForm } from "@/app/actions/crm";
import { FR_DELIVERY_LABEL, FR_PAYMENT_LABEL, type DeliveryMode, type PaymentMethod } from "@/lib/delivery";
import { formatDH } from "@/lib/format";
import { LEAD_STATUSES, fmtDateTime } from "@/lib/crm";
import { StatusBadge } from "../ui";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Demandes (admin)", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ statut?: string; refus?: string; id?: string }> }) {
  if (!(await pageAccess("orders"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const { statut, refus, id } = await searchParams;
  const filter = (LEAD_STATUSES as readonly string[]).includes(statut ?? "") ? statut : undefined;
  const orders = await prisma.order.findMany({ where: { ...(filter ? { status: filter } : {}), ...(refus === "1" ? { quoteRefusal: { not: null } } : {}), ...(id && /^\d+$/.test(id) ? { id: Number(id) } : {}) }, orderBy: { createdAt: "desc" }, include: { items: true }, take: 300 });
  return (
    <div>
      <p className="label-mono text-copper">Demandes</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Demandes de commande</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="orders-count">{orders.length} demande(s)</p>
      <nav aria-label="Filtrer par statut" className="mt-5 flex flex-wrap gap-1.5">
        {[undefined, ...LEAD_STATUSES].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/commandes?statut=${encodeURIComponent(s)}` : "/admin/commandes"} aria-current={filter === s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium", filter === s ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
            {s ?? "Tous"}
          </Link>
        ))}
        <Link href="/admin/commandes?refus=1" aria-current={refus === "1" ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1 text-xs font-medium", refus === "1" ? "border-foreground bg-foreground text-background" : "border-amber-500/50 hover:bg-muted")}>
          Devis refusés (à traiter)
        </Link>
      </nav>
      {orders.length === 0 ? (
        <p className="mt-10 rounded-[2px] border border-dashed border-border p-10 text-center text-muted-foreground">Aucune demande.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[2px] border border-border bg-card">
          <table className="w-full min-w-[980px] text-left text-sm" data-testid="orders-table">
            <thead className="label-mono bg-muted text-[0.65rem] text-muted-foreground">
              <tr>
                <th className="px-3 py-3">N° / date</th>
                <th className="px-3 py-3">Client</th>
                <th className="px-3 py-3">Articles</th>
                <th className="px-3 py-3">Livraison</th>
                <th className="px-3 py-3">Paiement</th>
                <th className="px-3 py-3 text-right">Total TTC</th>
                <th className="px-3 py-3">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border align-top">
              {orders.map((o) => (
                <tr key={o.id} data-testid="order-row" data-number={o.number}>
                  <td className="px-3 py-3">
                    <p className="font-mono font-semibold text-price">{o.number}</p>
                    <p className="text-xs text-muted-foreground">{fmtDateTime.format(o.createdAt)} · {o.origin}</p>
                  </td>
                  <td className="px-3 py-3">
                    {o.contactId ? <Link href={`/admin/clients/${o.contactId}`} className="font-semibold hover:underline">{o.customerName}</Link> : <p className="font-semibold">{o.customerName}</p>}
                    <p><a href={`tel:${o.phone}`} className="hover:underline">{o.phone}</a></p>
                    {o.email && <p className="text-xs">{o.email}</p>}
                    <p className="text-xs text-muted-foreground">{[o.city, o.address].filter(Boolean).join(" · ")}</p>
                    {(o.company || o.ice) && <p className="text-xs text-muted-foreground">{o.company}{o.ice ? ` · ICE ${o.ice}` : ""}</p>}
                    {o.quoteRefusal && <p className="mt-1 max-w-64 rounded bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-200" data-testid="quote-refusal">Devis auto refusé : {o.quoteRefusal}</p>}
                    {o.notes && <p className="mt-1 max-w-56 text-xs italic">« {o.notes} »</p>}
                    {(o.utmSource || o.gclid || o.fbclid) && <p className="mt-1 text-[0.7rem] text-muted-foreground">Source : {o.utmSource ?? (o.gclid ? "google (gclid)" : "meta (fbclid)")}{o.utmCampaign ? ` / ${o.utmCampaign}` : ""}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <ul className="space-y-0.5">
                      {o.items.map((i) => (
                        <li key={i.id}>{i.quantity} × {i.productId} <span className="text-xs text-muted-foreground">({formatDH(i.lineTotal)})</span></li>
                      ))}
                      {o.items.length === 0 && <li className="text-xs text-muted-foreground">—</li>}
                    </ul>
                  </td>
                  <td className="px-3 py-3">
                    <p>{FR_DELIVERY_LABEL[o.deliveryMode as DeliveryMode] ?? o.deliveryMode}</p>
                    <p className="text-xs text-muted-foreground">{o.deliveryFee ? formatDH(o.deliveryFee) : "0 / sur devis"}</p>
                  </td>
                  <td className="px-3 py-3">{FR_PAYMENT_LABEL[o.paymentMethod as PaymentMethod] ?? o.paymentMethod}</td>
                  <td className="px-3 py-3 text-right font-semibold whitespace-nowrap">{formatDH(o.total)}</td>
                  <td className="px-3 py-3">
                    <div className="mb-1.5"><StatusBadge status={o.status} /></div>
                    <form action={updateLeadStatusForm} className="flex gap-1">
                      <input type="hidden" name="orderId" value={o.id} />
                      <select name="status" defaultValue={o.status} aria-label={`Statut ${o.number}`} className="h-8 rounded border border-input bg-background px-1 text-xs">
                        {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <button className="h-8 rounded border border-border px-2 text-xs hover:bg-muted">OK</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
