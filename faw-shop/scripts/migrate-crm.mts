// Migration non destructive v1 -> v2 : statuts des demandes + rattachement aux contacts.
import { PrismaClient } from "@prisma/client";
import { upsertContactForLead } from "../src/lib/crm";

const db = new PrismaClient();
const MAP: Record<string, string> = { nouvelle: "nouveau", "confirmée": "gagné", "annulée": "perdu" };
const orders = await db.order.findMany({ orderBy: { createdAt: "asc" } });
for (const o of orders) {
  const status = MAP[o.status] ?? o.status;
  let contactId = o.contactId;
  if (!contactId) {
    const c = await upsertContactForLead(db, { name: o.customerName, phone: o.phone, email: o.email, city: o.city, company: o.company, ice: o.ice, source: o.origin });
    contactId = c.id;
  }
  await db.order.update({ where: { id: o.id }, data: { status, contactId } });
}
console.log(`migrated ${orders.length} orders, contacts: ${await db.contact.count()}`);
await db.$disconnect();
