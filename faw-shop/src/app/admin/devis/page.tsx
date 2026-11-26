import { pageAccess } from "@/lib/admin/perm";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { QUOTE_STATUSES, QUOTE_STATUS_LABEL, devisConfig, type QuoteStatus } from "@/lib/devis";
import { formatDH } from "@/lib/format";
import { emailConfig } from "@/lib/quote-email";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../ui";

export const dynamic = "force-dynamic";

const dt = new Intl.DateTimeFormat("fr-MA", { timeZone: "Africa/Casablanca", dateStyle: "short", timeStyle: "short" });

export default async function DevisAdminPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  if (!(await pageAccess("devis"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const raw = (await searchParams).statut;
  const statut = (QUOTE_STATUSES as readonly string[]).includes(raw ?? "") ? (raw as QuoteStatus) : null;
  const [quotes, counts, refused] = await Promise.all([
    prisma.quote.findMany({ where: statut ? { status: statut } : {}, orderBy: { createdAt: "desc" }, take: 200, include: { contact: { select: { id: true } } } }),
    prisma.quote.groupBy({ by: ["status"], _count: true }),
    prisma.order.count({ where: { quoteRefusal: { not: null } } }),
  ]);
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = counts.reduce((a, c) => a + c._count, 0);
  const cfg = devisConfig();
  const ec = emailConfig();
  const tabs: [string, string | null, number][] = [["Tous", null, total], ...QUOTE_STATUSES.map((s) => [QUOTE_STATUS_LABEL[s], s, count(s)] as [string, string, number])];
  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Devis</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Les demandes du site arrivent « à valider » : aucun numéro, aucun PDF pour le client. « Valider » réserve le numéro, produit le PDF, débloque le lien
            privé du client et, si l&apos;e-mail automatique est configuré et que le client a donné son e-mail, le lui envoie (devis « envoyé », ligne au journal).
            Sinon : envoi par WhatsApp puis « Marquer comme envoyé ».{" "}
            <Link href="/admin/commandes?refus=1" className="underline">{refused} demande(s) refusée(s) par les règles</Link> à traiter à la main.
          </p>
        </div>
        {ec.ok ? (
          <p className="rounded-lg bg-emerald-600/12 px-3 py-2 text-sm font-medium" data-testid="devis-email-config">Email automatique activé (Resend).</p>
        ) : (
          <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-medium" data-testid="devis-email-config">Email automatique non configuré : envoi manuel par WhatsApp / PDF.</p>
        )}
        {!cfg && <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm font-medium text-amber-800 dark:text-amber-200">Générateur non configuré : les demandes partent en « à traiter ».</p>}
      </div>

      <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2" data-testid="devis-tabs">
        {tabs.map(([label, s, n]) => (
          <Link
            key={label}
            href={s ? `/admin/devis?statut=${encodeURIComponent(s)}` : "/admin/devis"}
            aria-current={statut === s ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium",
              statut === s ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
            )}
          >
            {label}
            <span className={cn("rounded-full px-1.5 text-xs font-bold", s === "à valider" && n > 0 ? "bg-amber-500 text-black" : "bg-muted text-foreground")}>{n}</span>
          </Link>
        ))}
      </nav>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[52rem] text-sm" data-testid="devis-table">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5">Statut</th>
              <th scope="col" className="px-3 py-2.5">N°</th>
              <th scope="col" className="px-3 py-2.5">Demande reçue</th>
              <th scope="col" className="px-3 py-2.5">Client</th>
              <th scope="col" className="px-3 py-2.5">Ville</th>
              <th scope="col" className="px-3 py-2.5 text-right">Total TTC</th>
              <th scope="col" className="px-3 py-2.5"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody>
            {quotes.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Aucun devis{statut ? ` « ${QUOTE_STATUS_LABEL[statut]} »` : ""}.</td></tr>
            )}
            {quotes.map((q) => (
              <tr key={q.id} className="border-t border-border" data-testid="devis-row" data-status={q.status}>
                <td className="px-3 py-2.5"><StatusBadge status={q.status} /></td>
                <td className="px-3 py-2.5 font-mono font-semibold">{q.number ?? <span className="font-sans font-normal text-muted-foreground">—</span>}</td>
                <td className="px-3 py-2.5 whitespace-nowrap">{dt.format(q.createdAt)}</td>
                <td className="px-3 py-2.5">
                  {q.contact ? <Link href={`/admin/clients/${q.contact.id}`} className="font-medium hover:underline">{q.clientName}</Link> : q.clientName}
                  <span className="block text-xs text-muted-foreground">{q.clientType}{q.phone ? ` · ${q.phone}` : ""}</span>
                </td>
                <td className="px-3 py-2.5">{q.city}<span className="block text-xs text-muted-foreground">{q.transport}</span></td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">{formatDH(q.totalTtc)}</td>
                <td className="px-3 py-2.5 text-right">
                  <Link
                    href={`/admin/devis/${q.id}`}
                    data-testid="devis-open"
                    className={cn("inline-flex h-10 items-center rounded-full px-4 font-semibold", q.status === "à valider" || q.status === "validé" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted")}
                  >
                    {q.status === "à valider" ? "Vérifier et valider" : q.status === "validé" ? "Envoyer" : "Voir"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
