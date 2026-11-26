import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { LEAD_STATUSES, parseTags } from "./crm";

export type ContactFilters = { q?: string; tag?: string; type?: string; city?: string; statut?: string };

export function readFilters(sp: Record<string, string | string[] | undefined>): ContactFilters {
  const g = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim().slice(0, 100) : undefined) || undefined;
  return { q: g("q"), tag: g("tag"), type: g("type"), city: g("city"), statut: g("statut") };
}

export async function findContacts(f: ContactFilters) {
  const and: Prisma.ContactWhereInput[] = [];
  if (f.q) {
    const digits = f.q.replace(/\D/g, "");
    and.push({ OR: [
      { name: { contains: f.q } }, { company: { contains: f.q } }, { email: { contains: f.q } }, { ice: { contains: f.q } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits.replace(/^0/, "") } }] : []),
    ] });
  }
  if (f.type) and.push({ type: f.type });
  if (f.city) and.push({ city: { contains: f.city } });
  if (f.statut && (LEAD_STATUSES as readonly string[]).includes(f.statut)) and.push({ orders: { some: { status: f.statut } } });
  const rows = await prisma.contact.findMany({
    where: and.length ? { AND: and } : {},
    orderBy: { lastActivityAt: "desc" },
    include: { orders: { select: { status: true, total: true } }, tasks: { where: { done: false }, select: { id: true } } },
    take: 1000,
  });
  return rows
    .map((c) => ({
      ...c,
      tagList: parseTags(c.tags),
      ltv: c.orders.filter((o) => o.status === "gagné").reduce((a, o) => a + o.total, 0),
      leads: c.orders.length,
      openTasks: c.tasks.length,
    }))
    .filter((c) => !f.tag || c.tagList.some((t) => t.toLowerCase() === f.tag!.toLowerCase()));
}
