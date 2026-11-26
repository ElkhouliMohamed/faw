import { prisma } from "@/lib/db";
import { pageAccess } from "@/lib/admin/perm";
import { Kanban, type Card } from "./kanban";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  if (!(await pageAccess("orders"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, include: { items: { select: { productId: true, quantity: true } } }, take: 500 });
  const cards: Card[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    name: o.customerName,
    city: o.city,
    company: o.company,
    total: o.total,
    status: o.status,
    contactId: o.contactId,
    origin: o.origin,
    items: o.items.map((i) => `${i.quantity}× ${i.productId}`).join(", "),
  }));
  return (
    <div>
      <p className="label-mono text-copper">Pipeline</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Suivi des demandes</h1>
      <p className="mt-1 text-sm text-muted-foreground">Glissez une carte vers une autre colonne, ou utilisez le menu « Statut » de la carte (clavier).</p>
      <Kanban initial={cards} />
    </div>
  );
}
