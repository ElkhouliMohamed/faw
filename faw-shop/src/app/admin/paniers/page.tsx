import Link from "next/link";
import { pageAccess } from "@/lib/admin/perm";
import { ABANDON_MINUTES, CART_STATUSES, waLink } from "@/lib/carts";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/crm";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CartActions } from "./cart-actions";

export const dynamic = "force-dynamic";

export default async function PaniersPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const acc = await pageAccess("carts");
  if (!acc) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const st = (await searchParams).statut;
  const statut = (CART_STATUSES as readonly string[]).includes(st ?? "") ? st! : st === "tous" ? "tous" : "ouvert";
  const cutoff = new Date(Date.now() - ABANDON_MINUTES * 60_000);
  const where = { itemCount: { gt: 0 }, orderNumber: null, updatedAt: { lt: cutoff }, ...(statut === "tous" ? {} : { status: statut }) };
  const [carts, counts, products] = await Promise.all([
    prisma.cart.findMany({ where, orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.cart.groupBy({ by: ["status"], where: { itemCount: { gt: 0 }, orderNumber: null, updatedAt: { lt: cutoff } }, _count: true }),
    prisma.product.findMany({ select: { id: true, title: true } }),
  ]);
  const title = new Map(products.map((p) => [p.id, p.title]));
  const count = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  return (
    <div data-testid="carts-page">
      <p className="label-mono text-copper">Ventes</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Paniers abandonnés</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Paniers avec au moins un article, sans demande envoyée, inactifs depuis plus de {ABANDON_MINUTES} min. Téléphone / e-mail présents seulement si le client les a saisis au formulaire de commande.
      </p>
      <nav className="mt-4 flex flex-wrap gap-1" aria-label="Statut">
        {[...CART_STATUSES, "tous"].map((s) => (
          <Link key={s} href={`?statut=${encodeURIComponent(s)}`} aria-current={s === statut ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-sm", s === statut ? "bg-foreground text-background" : "border border-border hover:bg-muted")}>
            {s}{s !== "tous" && <span className="ms-1 opacity-70">({count(s)})</span>}
          </Link>
        ))}
      </nav>
      <ul className="mt-4 grid gap-3" data-testid="carts-list">
        {carts.map((c) => {
          let items: { id: string; qty: number }[] = [];
          try { items = JSON.parse(c.items); } catch {}
          const summary = items.map((i) => `${i.qty} × ${title.get(i.id) ?? i.id.replace(/^pack:/, "Pack ")}`).join(", ");
          const msg = `Bonjour${c.name ? ` ${c.name}` : ""}, ici l'équipe FAW Aluminium. Vous aviez préparé une sélection sur notre site (${summary.slice(0, 300)}). Avez-vous des questions ? Nous pouvons vous préparer un devis.`;
          const wa = c.phone ? waLink(c.phone, msg) : null;
          return (
            <li key={c.id} className="grid gap-3 rounded-[2px] border border-border bg-card p-4 md:grid-cols-[1fr_auto]" data-testid="cart-row" data-id={c.id}>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{c.name ?? "Visiteur anonyme"} <span className="font-normal text-muted-foreground">· {formatDH(c.subtotal)} · {c.itemCount} article(s)</span></p>
                <p className="mt-1 break-words text-sm">{summary || "—"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Dernière activité {fmtDateTime.format(c.updatedAt)}{c.utmSource ? ` · source ${c.utmSource}` : ""}{c.remindedAt ? ` · relancé ${fmtDateTime.format(c.remindedAt)}` : ""}
                </p>
                <p className="mt-1 text-xs">
                  {c.phone ? <span className="font-mono" dir="ltr">{c.phone}</span> : <span className="text-muted-foreground">Pas de téléphone</span>}
                  {c.email && <span className="ms-2 font-mono">{c.email}</span>}
                </p>
              </div>
              <CartActions id={c.id} status={c.status} wa={wa} write={acc.write} />
            </li>
          );
        })}
        {!carts.length && <li className="rounded-[2px] border border-dashed border-border p-8 text-center text-sm text-muted-foreground" data-testid="carts-empty">Aucun panier dans ce statut.</li>}
      </ul>
    </div>
  );
}
