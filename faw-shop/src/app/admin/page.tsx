import Link from "next/link";
import { prisma } from "@/lib/db";
import { pageAccess } from "@/lib/admin/perm";
import { toggleTask } from "@/app/actions/crm";
import { LEAD_STATUSES, fmtDate, fmtDateTime, todayBoundsCasablanca } from "@/lib/crm";
import { formatDH } from "@/lib/format";
import { StatusBadge } from "./ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  if (!(await pageAccess("dashboard"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const { start, end } = todayBoundsCasablanca();
  const [tasks, byStatus, recent, contacts, pendingQuotes] = await Promise.all([
    prisma.task.findMany({ where: { done: false, dueDate: { lt: end } }, orderBy: { dueDate: "asc" }, include: { contact: { select: { id: true, name: true, phone: true } } } }),
    prisma.order.groupBy({ by: ["status"], _count: true, _sum: { total: true } }),
    prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.contact.count(),
    prisma.quote.count({ where: { status: "à valider" } }),
  ]);
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const [sessions7, atc7, orders7, carts7] = await Promise.all([
    prisma.event.findMany({ where: { type: "view", at: { gte: since7 } }, distinct: ["sid"], select: { sid: true } }).then((r) => r.length),
    prisma.event.findMany({ where: { type: "add_to_cart", at: { gte: since7 } }, distinct: ["sid"], select: { sid: true } }).then((r) => r.length),
    prisma.order.count({ where: { createdAt: { gte: since7 } } }),
    prisma.cart.count({ where: { itemCount: { gt: 0 }, orderNumber: null, status: "ouvert", updatedAt: { lt: new Date(Date.now() - 30 * 60_000) } } }),
  ]);
  const stat = (s: string) => byStatus.find((b) => b.status === s);
  const open = ["nouveau", "contacté", "devis envoyé"].reduce((a, s) => a + (stat(s)?._sum.total ?? 0), 0);
  return (
    <div className="space-y-10">
      <div>
        <p className="label-mono text-copper">Tableau de bord</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Bonjour l&apos;équipe FAW</h1>
      </div>

      <Link
        href={`/admin/devis?statut=${encodeURIComponent("à valider")}`}
        data-testid="dash-devis-a-valider"
        className={cn(
          "flex items-center justify-between gap-4 rounded-[2px] border p-5 transition hover:brightness-105",
          pendingQuotes ? "border-amber-500/60 bg-amber-500/12" : "border-border bg-card",
        )}
      >
        <span>
          <span className="label-mono block text-[0.65rem] text-muted-foreground">Devis à valider</span>
          <span className="mt-1 block text-sm text-muted-foreground">{pendingQuotes ? "Demandes du site en attente de l'équipe : rien n'est parti au client." : "Aucune demande en attente."}</span>
        </span>
        <span className="text-3xl font-bold tabular-nums">{pendingQuotes}</span>
      </Link>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-border bg-border lg:grid-cols-4">
        {[
          ["Contacts", String(contacts)],
          ["Nouvelles demandes", String(stat("nouveau")?._count ?? 0)],
          ["Pipeline ouvert", formatDH(open)],
          ["Gagné", formatDH(stat("gagné")?._sum.total ?? 0)],
        ].map(([k, v]) => (
          <div key={k} className="bg-card p-5">
            <dt className="label-mono text-[0.65rem] text-muted-foreground">{k}</dt>
            <dd className="mt-2 text-2xl font-bold tracking-tight">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="sept-jours" data-testid="dash-7d">
        <div className="flex items-baseline justify-between">
          <h2 id="sept-jours" className="text-xl font-bold">7 derniers jours</h2>
          <Link href="/admin/analytics" className="text-sm font-semibold text-copper hover:underline">Analytics →</Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-border bg-border lg:grid-cols-4">
          {(
            [
              ["Sessions", sessions7, "/admin/analytics?j=7"],
              ["Paniers créés", atc7, "/admin/analytics?j=7"],
              ["Demandes reçues", orders7, "/admin/commandes"],
              ["Paniers à relancer", carts7, "/admin/paniers"],
            ] as const
          ).map(([k, v, h]) => (
            <Link key={k} href={h} className="bg-card p-5 hover:bg-muted">
              <span className="label-mono block text-[0.65rem] text-muted-foreground">{k}</span>
              <span className="mt-2 block text-2xl font-bold tabular-nums">{v}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7" aria-labelledby="relances" data-testid="relances">
          <div className="flex items-baseline justify-between">
            <h2 id="relances" className="text-xl font-bold">Relances du jour</h2>
            <span className="text-sm text-muted-foreground">{tasks.length} à traiter (en retard + aujourd&apos;hui)</span>
          </div>
          {tasks.length === 0 ? (
            <p className="mt-4 rounded-[2px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Aucune relance en attente.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border rounded-[2px] border border-border bg-card">
              {tasks.map((t) => {
                const late = t.dueDate < start;
                return (
                  <li key={t.id} className="flex items-center gap-4 p-4" data-testid="relance-item">
                    <form action={toggleTask}>
                      <input type="hidden" name="taskId" value={t.id} />
                      <button aria-label={`Marquer « ${t.title} » comme faite`} className="grid size-6 place-items-center rounded-full border-2 border-border hover:border-copper" />
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-sm text-muted-foreground">
                        <Link href={`/admin/clients/${t.contact.id}`} className="hover:underline">{t.contact.name}</Link> · <a href={`tel:${t.contact.phone}`} className="hover:underline">{t.contact.phone}</a>
                      </p>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", late ? "bg-destructive/12 text-destructive" : "bg-copper/12 text-copper")}>
                      {late ? `En retard · ${fmtDate.format(t.dueDate)}` : "Aujourd'hui"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="lg:col-span-5" aria-labelledby="pipe">
          <div className="flex items-baseline justify-between">
            <h2 id="pipe" className="text-xl font-bold">Pipeline</h2>
            <Link href="/admin/pipeline" className="text-sm text-copper hover:underline">Ouvrir le Kanban →</Link>
          </div>
          <ul className="mt-4 space-y-2">
            {LEAD_STATUSES.map((s) => (
              <li key={s} className="flex items-center justify-between rounded-[2px] border border-border bg-card px-4 py-3 text-sm">
                <span className="flex items-center gap-2"><StatusBadge status={s} /> <span className="text-muted-foreground">{stat(s)?._count ?? 0}</span></span>
                <span className="font-semibold">{formatDH(stat(s)?._sum.total ?? 0)}</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 text-xl font-bold">Dernières demandes</h2>
          <ul className="mt-4 divide-y divide-border rounded-[2px] border border-border bg-card text-sm">
            {recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0">
                  {o.contactId ? <Link className="font-medium hover:underline" href={`/admin/clients/${o.contactId}`}>{o.customerName}</Link> : o.customerName}
                  <span className="block text-xs text-muted-foreground">{o.number} · {fmtDateTime.format(o.createdAt)}</span>
                </span>
                <StatusBadge status={o.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
