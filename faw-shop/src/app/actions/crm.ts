"use server";
import { requireWrite } from "@/lib/admin/perm";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { CONTACT_TYPES, INTERACTION_TYPES, LEAD_STATUSES, joinTags, normalizePhone, orderNumber, upsertContactForLead, ymdToCasablancaDate } from "@/lib/crm";

async function guard() {
  return requireWrite("clients");
}
function revalidateAll(contactId?: number | null) {
  revalidatePath("/admin");
  revalidatePath("/admin/pipeline");
  revalidatePath("/admin/commandes");
  revalidatePath("/admin/clients");
  if (contactId) revalidatePath(`/admin/clients/${contactId}`);
}

export async function updateLeadStatus(orderId: number, status: string) {
  await guard();
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) return { ok: false as const };
  const o = await prisma.order.findUnique({ where: { id: orderId } });
  if (!o) return { ok: false as const };
  if (o.status !== status) {
    await prisma.$transaction([
      prisma.order.update({ where: { id: orderId }, data: { status } }),
      prisma.leadEvent.create({ data: { orderId, fromStatus: o.status, toStatus: status } }),
      ...(o.contactId ? [prisma.contact.update({ where: { id: o.contactId }, data: { lastActivityAt: new Date() } })] : []),
    ]);
  }
  revalidateAll(o.contactId);
  return { ok: true as const };
}

export async function updateLeadStatusForm(fd: FormData) {
  await updateLeadStatus(Number(fd.get("orderId")), String(fd.get("status")));
}

export async function addInteraction(fd: FormData) {
  await guard();
  const contactId = Number(fd.get("contactId"));
  const type = String(fd.get("type"));
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000) || null;
  if (!Number.isInteger(contactId) || !(INTERACTION_TYPES as readonly string[]).includes(type)) return;
  await prisma.$transaction([
    prisma.interaction.create({ data: { contactId, type, note } }),
    prisma.contact.update({ where: { id: contactId }, data: { lastActivityAt: new Date() } }),
  ]);
  revalidateAll(contactId);
}

export async function addTask(fd: FormData) {
  await guard();
  const contactId = Number(fd.get("contactId"));
  const title = String(fd.get("title") ?? "").trim().slice(0, 300);
  const due = String(fd.get("dueDate") ?? "");
  if (!Number.isInteger(contactId) || !title || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return;
  await prisma.task.create({ data: { contactId, title, dueDate: ymdToCasablancaDate(due) } });
  revalidateAll(contactId);
}

export async function toggleTask(fd: FormData) {
  await guard();
  const id = Number(fd.get("taskId"));
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  await prisma.task.update({ where: { id }, data: { done: !t.done, doneAt: t.done ? null : new Date() } });
  revalidateAll(t.contactId);
}

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().max(160).email().optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  type: z.enum(CONTACT_TYPES),
  company: z.string().trim().max(160).optional(),
  ice: z.string().trim().max(30).optional(),
  tags: z.string().max(400).optional(),
});

export async function updateContact(fd: FormData) {
  await guard();
  const id = Number(fd.get("contactId"));
  const v = contactSchema.safeParse(Object.fromEntries(["name", "email", "city", "type", "company", "ice", "tags"].map((k) => [k, String(fd.get(k) ?? "")])));
  if (!v.success || !Number.isInteger(id)) return;
  const d = v.data;
  await prisma.contact.update({
    where: { id },
    data: {
      name: d.name,
      email: d.email || null,
      city: d.city || null,
      type: d.type,
      company: d.company || null,
      ice: d.ice || null,
      tags: joinTags((d.tags ?? "").split(",")),
    },
  });
  revalidateAll(id);
}

export type ManualState = { error?: string } | null;

export async function createManual(_: ManualState, fd: FormData): Promise<ManualState> {
  await guard();
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const name = g("name");
  const phone = g("phone");
  if (name.length < 2) return { error: "Nom requis" };
  if (normalizePhone(phone).replace(/\D/g, "").length < 9) return { error: "Téléphone invalide" };
  const type = g("type") === "entreprise" ? "entreprise" : "particulier";
  const value = Math.max(0, Math.round(Number(g("value").replace(/\s/g, "")) || 0));
  const withLead = g("withLead") === "on";
  const status = (LEAD_STATUSES as readonly string[]).includes(g("status")) ? g("status") : "nouveau";
  const source = ["téléphone", "visite", "whatsapp", "salon", "recommandation", "autre"].includes(g("source")) ? g("source") : "autre";

  const contactId = await prisma.$transaction(async (tx) => {
    const c = await upsertContactForLead(tx, {
      name, phone, email: g("email") || null, city: g("city") || null, company: g("company") || null, ice: g("ice") || null,
      source, type, tags: g("tags").split(","),
    });
    if (withLead) {
      await tx.order.create({
        data: {
          number: orderNumber(),
          origin: "manuel",
          status,
          contactId: c.id,
          customerName: c.name,
          phone: c.phone,
          email: c.email,
          city: c.city ?? "",
          address: "",
          company: c.company,
          ice: c.ice,
          deliveryMode: "n/a",
          deliveryFee: 0,
          paymentMethod: "à définir",
          notes: g("leadNote") || null,
          subtotal: value,
          total: value,
          events: { create: { toStatus: status } },
        },
      });
    }
    await tx.interaction.create({ data: { contactId: c.id, type: source === "visite" ? "visite" : source === "whatsapp" ? "whatsapp" : "appel", note: "Contact créé manuellement" } });
    return c.id;
  });
  revalidateAll(contactId);
  redirect(`/admin/clients/${contactId}`);
}
