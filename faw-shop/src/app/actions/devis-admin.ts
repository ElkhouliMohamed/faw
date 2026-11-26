"use server";
import { requireWrite } from "@/lib/admin/perm";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getProductById } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import {
  DevisError, appendJournal, casablancaStamp, devisConfig, dryRun, generateFinal, generatorLines, journalProducts, linesJson, refusalReasons, reserveNumber, serialized, unitPrices,
  type DevisConfig, type GeneratorInput, type JournalInput, type QuoteLine,
} from "@/lib/devis";
import { warrantiesForIds } from "@/lib/merch";
import { emailConfig, sendQuoteEmail, validClientEmail } from "@/lib/quote-email";

export type DevisActionState = { ok: boolean; message: string } | null;

async function guard() {
  return requireWrite("devis");
}
const idSchema = z.coerce.number().int().min(1);

function refresh(id: number) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/admin/devis/${id}`);
}

type StoredLine = { id: string; qty: number };
type GenInput = { lignes: { reference: string; qte: number; largeur_vantail_m?: number }[] } & Record<string, unknown>;

/** Relit les produits actuels et refait les contrôles (règles de refus, essai à blanc du générateur). */
async function recheck(cfg: DevisConfig, stored: StoredLine[], gen: GenInput, note: string | null) {
  const lines: QuoteLine[] = [];
  for (const l of stored) {
    const p = await getProductById(l.id);
    if (!p || !p.active) return { error: `Produit inconnu ou désactivé : ${l.id}` } as const;
    lines.push({ p, qty: l.qty });
  }
  const kitLeaf = gen.lignes.find((g) => g.largeur_vantail_m)?.largeur_vantail_m ?? null;
  const reasons = refusalReasons(lines, { note: note ?? "", custom: false, kitLeafM: kitLeaf });
  if (reasons.length) return { error: `Ne peut pas être validé tel quel : ${reasons.join(" ; ")}. Modifiez les quantités ou refusez le devis.` } as const;
  const priced = unitPrices(lines);
  const total = priced.reduce((s, l) => s + l.total, 0);
  const genInput: GenInput = { ...gen, lignes: generatorLines(priced, kitLeaf) };
  let dry: number;
  try {
    dry = Math.round(await dryRun(cfg, { ...(genInput as unknown as GeneratorInput), date: casablancaStamp().pdf }));
  } catch (e) {
    return { error: `Générateur : ${e instanceof DevisError ? e.message : "erreur interne"}` } as const;
  }
  if (dry !== total) return { error: `Prix du site (${total} DH) différent du référentiel devis (${dry} DH).` } as const;
  return { priced, total, genInput } as const;
}

/** « Valider » : réserve le numéro (compteur partagé), produit le PDF définitif, puis envoie l'e-mail au client si configuré. */
export async function validateQuote(_p: DevisActionState, fd: FormData): Promise<DevisActionState> {
  await guard();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Devis invalide." };
  const cfg = devisConfig();
  if (!cfg) return { ok: false, message: "Générateur de devis non configuré (variables DEVIS_*)." };
  let res: DevisActionState;
  try {
    res = await serialized(async () => {
      const q = await prisma.quote.findUnique({ where: { id: id.data } });
      if (!q) return { ok: false, message: "Devis introuvable." };
      if (q.status !== "à valider") return { ok: false, message: `Devis déjà traité (statut : ${q.status}).` };
      const stored: StoredLine[] = JSON.parse(q.lines);
      const chk = await recheck(cfg, stored, JSON.parse(q.genInput), q.note);
      if ("error" in chk) return { ok: false, message: chk.error! };
      if (chk.total !== q.totalTtc) return { ok: false, message: `Les prix ont changé depuis la demande (${q.totalTtc} → ${chk.total} DH). Enregistrez les quantités pour recalculer, puis validez.` };
      // Numéro déjà réservé lors d'une tentative précédente ? On le réutilise (jamais deux numéros pour un devis).
      let numero = q.number ? Number(q.number) : 0;
      if (!numero) {
        numero = await reserveNumber(cfg);
        await prisma.quote.update({ where: { id: q.id }, data: { number: String(numero) } });
      }
      const file = `Devis-${numero}-FAW.pdf`;
      let ttc: number;
      try {
        ({ ttc } = await generateFinal(cfg, { ...(chk.genInput as unknown as GeneratorInput), date: casablancaStamp().pdf, numero }, file));
      } catch (e) {
        return { ok: false, message: `Numéro ${numero} réservé mais PDF non généré : ${(e as Error).message}. Réessayez (le même numéro sera réutilisé).` };
      }
      if (Math.round(ttc) !== q.totalTtc) return { ok: false, message: `PDF ${file} : total ${Math.round(ttc)} DH différent du devis (${q.totalTtc} DH).` };
      await prisma.$transaction([
        prisma.quote.update({ where: { id: q.id }, data: { status: "validé", pdfFile: file, validatedAt: new Date() } }),
        ...(q.contactId ? [prisma.interaction.create({ data: { contactId: q.contactId, type: "note", note: `Devis n° ${numero} validé par l'équipe (${q.totalTtc} DH TTC), prêt à envoyer.` } })] : []),
      ]);
      return { ok: true, message: `Devis n° ${numero} validé. PDF définitif prêt, lien privé du client débloqué.` };
    });
  } catch (e) {
    res = { ok: false, message: e instanceof DevisError ? e.message : "Erreur interne lors de la validation." };
  }
  // Envoi automatique par e-mail, uniquement après une validation réussie par ce clic. Un échec ne bloque pas la validation.
  if (res?.ok) {
    const q = await prisma.quote.findUnique({ where: { id: id.data }, select: { email: true } });
    const ec = emailConfig();
    if (!validClientEmail(q?.email)) res = { ok: true, message: `${res.message} Pas d'e-mail client : envoyez le lien privé par WhatsApp (panneau ci-dessous).` };
    else if (!ec.ok) res = { ok: true, message: `${res.message} Email automatique non configuré : envoi manuel (panneau ci-dessous).` };
    else {
      const sent = await sendEmailStep(id.data, cfg, "auto");
      res = sent.ok ? { ok: true, message: `${res.message} ${sent.message}` } : { ok: false, message: `${res.message} E-mail NON envoyé : ${sent.message} Le devis reste validé ; utilisez « Renvoyer l'email » ou le panneau WhatsApp.` };
    }
  }
  refresh(id.data);
  return res;
}

type JournalVia = { via: "email"; messageId: string } | { via: "manuel" };

/**
 * Remise effective au client : ligne de journal (une seule fois par devis), statut « envoyé »,
 * interaction CRM « devis », demande en « devis envoyé ». À appeler dans serialized().
 */
async function deliver(cfg: DevisConfig, quoteId: number, how: JournalVia) {
  const q = await prisma.quote.findUnique({ where: { id: quoteId }, include: { order: true } });
  if (!q || !q.number || !q.pdfFile) throw new DevisError("Devis sans numéro ou sans PDF.");
  if (q.status === "envoyé") return;
  const j: JournalInput = JSON.parse(q.journalInput);
  if (!q.journaled) {
    await appendJournal(cfg, {
      numero: Number(q.number),
      date: casablancaStamp().journal,
      last4: j.last4,
      nom: j.nom,
      produits: j.produits,
      total: q.totalTtc,
      ville: j.ville,
      remarque:
        how.via === "email"
          ? `Devis site validé par l'équipe ; PDF ${q.pdfFile} ; envoyé automatiquement au client par e-mail (Resend ${how.messageId})`
          : `Devis site validé par l'équipe ; PDF ${q.pdfFile} ; envoyé au client par Walfar (WhatsApp), rien envoyé automatiquement par le site`,
    });
    await prisma.quote.update({ where: { id: q.id }, data: { journaled: true } });
  }
  await prisma.$transaction([
    prisma.quote.update({ where: { id: q.id }, data: { status: "envoyé", sentAt: new Date(), deliveredVia: how.via } }),
    ...(q.contactId
      ? [prisma.interaction.create({ data: { contactId: q.contactId, type: "devis", note: `Devis n° ${q.number} envoyé au client${how.via === "email" ? " par e-mail" : ""} : ${q.totalTtc} DH TTC (${q.transport}). PDF ${q.pdfFile}.` } })]
      : []),
    ...(q.order && q.order.status !== "devis envoyé"
      ? [
          prisma.order.update({ where: { id: q.order.id }, data: { status: "devis envoyé" } }),
          prisma.leadEvent.create({ data: { orderId: q.order.id, fromStatus: q.order.status, toStatus: "devis envoyé" } }),
        ]
      : []),
  ]);
}

/**
 * Envoi de l'e-mail du devis. « auto » : seulement si aucun envoi n'a jamais été tenté pour ce devis (idempotent).
 * « manuel » : bouton « Renvoyer l'email » (un envoi par clic, anti double-clic, 20 s par défaut).
 */
async function sendEmailStep(quoteId: number, cfg: DevisConfig, mode: "auto" | "manuel"): Promise<{ ok: boolean; message: string }> {
  try {
    return await serialized(async () => {
      const q = await prisma.quote.findUnique({ where: { id: quoteId } });
      if (!q || !q.number || !q.pdfFile || (q.status !== "validé" && q.status !== "envoyé")) return { ok: false, message: "Le devis doit être validé." };
      const to = validClientEmail(q.email);
      if (!to) return { ok: false, message: "Pas d'adresse e-mail valide pour ce client." };
      if (mode === "auto" && (q.emailAttempts > 0 || q.emailSentAt)) return { ok: true, message: "E-mail déjà traité pour ce devis (aucun nouvel envoi)." };
      const minGap = Number(process.env.QUOTE_EMAIL_RESEND_MIN_SECONDS) > 0 ? Number(process.env.QUOTE_EMAIL_RESEND_MIN_SECONDS) : 20;
      if (mode === "manuel" && q.emailLastAttemptAt && Date.now() - q.emailLastAttemptAt.getTime() < minGap * 1000)
        return { ok: false, message: `Envoi tenté il y a moins de ${minGap} secondes : patientez avant de renvoyer.` };
      const attempt = q.emailAttempts + 1;
      await prisma.quote.update({ where: { id: q.id }, data: { emailAttempts: attempt, emailLastAttemptAt: new Date() } });
      let ids: string[] = [];
      try { ids = (JSON.parse(q.lines) as { id: string }[]).map((l) => String(l.id)); } catch {}
      const warranties = await warrantiesForIds(ids).catch(() => []);
      const r = await sendQuoteEmail(
        { to, clientName: q.clientName, number: q.number, totalTtc: q.totalTtc, transport: q.transport, pdfFile: q.pdfFile, warranties },
        `faw-devis-${q.id}-${q.number}-${attempt}`,
      );
      if (!r.ok) {
        await prisma.quote.update({ where: { id: q.id }, data: { emailStatus: "échec", emailError: r.error } });
        return { ok: false, message: r.error };
      }
      await prisma.quote.update({ where: { id: q.id }, data: { emailStatus: "envoyé", emailSentAt: new Date(), emailMessageId: r.id, emailError: null } });
      if (q.status === "validé") await deliver(cfg, q.id, { via: "email", messageId: r.id });
      else if (q.contactId) await prisma.interaction.create({ data: { contactId: q.contactId, type: "note", note: `E-mail du devis n° ${q.number} renvoyé au client (${r.id}).` } });
      return { ok: true, message: `E-mail envoyé au client (${to}), avec le PDF en pièce jointe.` };
    });
  } catch (e) {
    return { ok: false, message: e instanceof DevisError ? `Journal : ${e.message}` : "Erreur interne lors de l'envoi de l'e-mail." };
  }
}

/** « Renvoyer l'email » : clic explicite de l'équipe, devis validé ou envoyé. */
export async function resendQuoteEmail(_p: DevisActionState, fd: FormData): Promise<DevisActionState> {
  await guard();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Devis invalide." };
  const cfg = devisConfig();
  if (!cfg) return { ok: false, message: "Générateur de devis non configuré." };
  const ec = emailConfig();
  if (!ec.ok) return { ok: false, message: `Email automatique non configuré (${ec.reason}).` };
  const r = await sendEmailStep(id.data, cfg, "manuel");
  refresh(id.data);
  return r;
}

const qtySchema = z.coerce.number().int("Quantité entière").min(0).max(9999);

/** Modification simple des quantités, uniquement avant validation (0 = retirer la ligne). */
export async function updateQuoteQuantities(_p: DevisActionState, fd: FormData): Promise<DevisActionState> {
  await guard();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Devis invalide." };
  const cfg = devisConfig();
  if (!cfg) return { ok: false, message: "Générateur de devis non configuré." };
  return serialized(async () => {
    const q = await prisma.quote.findUnique({ where: { id: id.data } });
    if (!q || q.status !== "à valider") return { ok: false, message: "Seul un devis « à valider » peut être modifié." };
    const stored: StoredLine[] = JSON.parse(q.lines);
    const next: StoredLine[] = [];
    for (const l of stored) {
      const v = qtySchema.safeParse(fd.get(`qty:${l.id}`) ?? l.qty);
      if (!v.success) return { ok: false, message: `${l.id} : quantité invalide.` };
      if (v.data > 0) next.push({ id: l.id, qty: v.data });
    }
    if (!next.length) return { ok: false, message: "Il faut au moins une ligne. Pour abandonner, utilisez « Refuser / annuler »." };
    const chk = await recheck(cfg, next, JSON.parse(q.genInput), q.note);
    if ("error" in chk) return { ok: false, message: chk.error! };
    const journal: JournalInput = { ...JSON.parse(q.journalInput), produits: journalProducts(chk.priced) };
    await prisma.$transaction(async (tx) => {
      await tx.quote.update({
        where: { id: q.id },
        data: { lines: linesJson(chk.priced), totalTtc: chk.total, totalHt: Math.round((chk.total / 1.2) * 100) / 100, genInput: JSON.stringify(chk.genInput), journalInput: JSON.stringify(journal) },
      });
      if (q.orderId) {
        await tx.orderItem.deleteMany({ where: { orderId: q.orderId } });
        await tx.order.update({
          where: { id: q.orderId },
          data: {
            subtotal: chk.total,
            total: chk.total,
            items: { create: chk.priced.map((l) => ({ productId: l.p.id, title: l.p.title, category: l.p.category, unitPrice: l.unit, quantity: l.qty, lineTotal: l.total })) },
          },
        });
      }
    });
    refresh(q.id);
    return { ok: true, message: `Quantités enregistrées. Nouveau total : ${chk.total} DH TTC.` };
  });
}

/**
 * « Marquer comme envoyé » : après que Walfar a envoyé le PDF lui-même (WhatsApp).
 * Ajoute la ligne au journal réel, passe le devis « envoyé » et la commande « devis envoyé ». Le site n'envoie rien.
 */
export async function markQuoteSent(_p: DevisActionState, fd: FormData): Promise<DevisActionState> {
  await guard();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { ok: false, message: "Devis invalide." };
  const cfg = devisConfig();
  if (!cfg) return { ok: false, message: "Générateur de devis non configuré." };
  let res: DevisActionState;
  try {
    res = await serialized(async () => {
      const q = await prisma.quote.findUnique({ where: { id: id.data } });
      if (!q) return { ok: false, message: "Devis introuvable." };
      if (q.status !== "validé" || !q.number || !q.pdfFile) return { ok: false, message: `Le devis doit être « validé » avant l'envoi (statut : ${q.status}).` };
      await deliver(cfg, q.id, { via: "manuel" });
      return { ok: true, message: `Devis n° ${q.number} marqué comme envoyé et inscrit au journal.` };
    });
  } catch (e) {
    res = { ok: false, message: e instanceof DevisError ? `Journal : ${e.message}` : "Erreur interne lors de l'envoi." };
  }
  refresh(id.data);
  return res;
}

const cancelSchema = z.object({ id: idSchema, reason: z.string().trim().max(300, "300 caractères maximum") });

/** « Refuser / annuler » : depuis « à valider » ou « validé ». Un numéro déjà réservé reste attaché au devis. */
export async function cancelQuote(_p: DevisActionState, fd: FormData): Promise<DevisActionState> {
  await guard();
  const v = cancelSchema.safeParse({ id: fd.get("id"), reason: fd.get("reason") ?? "" });
  if (!v.success) return { ok: false, message: v.error.issues[0]?.message ?? "Données invalides." };
  return serialized(async () => {
    const q = await prisma.quote.findUnique({ where: { id: v.data.id } });
    if (!q) return { ok: false, message: "Devis introuvable." };
    if (q.status !== "à valider" && q.status !== "validé") return { ok: false, message: `Impossible d'annuler un devis « ${q.status} ».` };
    await prisma.$transaction([
      prisma.quote.update({ where: { id: q.id }, data: { status: "refusé", cancelledAt: new Date(), cancelReason: v.data.reason || null } }),
      ...(q.contactId
        ? [prisma.interaction.create({ data: { contactId: q.contactId, type: "note", note: `Devis${q.number ? ` n° ${q.number}` : ""} refusé / annulé par l'équipe${v.data.reason ? ` : ${v.data.reason}` : ""}.` } })]
        : []),
    ]);
    refresh(q.id);
    return { ok: true, message: "Devis refusé / annulé." };
  });
}
