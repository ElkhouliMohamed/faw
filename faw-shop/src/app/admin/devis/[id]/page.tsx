import { pageAccess } from "@/lib/admin/perm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/crm";
import { QUOTE_STATUS_LABEL, devisConfig, waClientLink, whatsappTemplate, type QuoteStatus } from "@/lib/devis";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../../ui";
import { emailConfig, privateLink, publicBaseUrl, validClientEmail } from "@/lib/quote-email";
import { CancelForm, LinesEditor, ResendEmailButton, SendPanel, ValidateButton } from "./quote-actions";

export const dynamic = "force-dynamic";

type Line = { id: string; title: string; qty: number; unit: number; total: number; tier?: boolean };

export default async function DevisDetail({ params }: { params: Promise<{ id: string }> }) {
  if (!(await pageAccess("devis"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const q = await prisma.quote.findUnique({ where: { id }, include: { order: { select: { id: true, number: true, status: true } } } });
  if (!q) notFound();
  let lines: Line[] = [];
  try {
    lines = JSON.parse(q.lines);
  } catch {}
  const status = q.status as QuoteStatus;
  const link = privateLink(await publicBaseUrl(), q.token);
  const message = `${await whatsappTemplate(devisConfig(), q.totalTtc)}\nVotre devis (lien privé) : ${link}`;
  const ec = emailConfig();
  const clientEmail = validClientEmail(q.email);
  const autoEmail = ec.ok && !!clientEmail;
  const validateHint = autoEmail
    ? `Réserve le prochain numéro, produit le PDF définitif, débloque le lien privé du client et lui envoie le devis par e-mail (${clientEmail}).`
    : `Réserve le prochain numéro, produit le PDF définitif et débloque le lien privé du client. ${ec.ok ? "Pas d'e-mail client" : "Email automatique non configuré"} : vous enverrez le lien par WhatsApp.`;
  const final = (status === "validé" || status === "envoyé") && q.pdfFile;
  const preview = final ? null : `/admin/devis/${q.id}/brouillon?format=png`;
  return (
    <div className="space-y-8 pb-16" data-testid="devis-detail" data-status={q.status}>
      <div>
        <Link href="/admin/devis" className="text-sm text-muted-foreground hover:underline">← Tous les devis</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{q.number ? <>Devis n° <span data-testid="devis-number">{q.number}</span></> : "Demande de devis (sans numéro)"}</h1>
          <StatusBadge status={q.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Reçue le {fmtDateTime.format(q.createdAt)} · {q.clientName} ({q.clientType}) · {q.phone || "téléphone absent"} · {q.city}
          {q.order && <> · <Link href={`/admin/commandes?id=${q.order.id}`} className="underline">demande {q.order.number}</Link> ({q.order.status})</>}
          {q.contactId && <> · <Link href={`/admin/clients/${q.contactId}`} className="underline">fiche client</Link></>}
        </p>
        {q.validatedAt && <p className="text-sm text-muted-foreground">Validé le {fmtDateTime.format(q.validatedAt)}{q.sentAt ? ` · envoyé le ${fmtDateTime.format(q.sentAt)}` : ""}</p>}
        {status === "refusé" && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-sm" data-testid="devis-refus-info">
            Refusé / annulé{q.cancelledAt ? ` le ${fmtDateTime.format(q.cancelledAt)}` : ""}{q.cancelReason ? ` : ${q.cancelReason}` : ""}.
            {q.number ? ` Le numéro ${q.number} reste attaché à ce devis.` : " Aucun numéro consommé."}
          </p>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <section aria-labelledby="lignes">
            <h2 id="lignes" className="mb-3 text-lg font-bold">Lignes</h2>
            <LinesEditor id={q.id} lines={lines} editable={status === "à valider"} />
            <dl className="mt-3 grid max-w-sm grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Total HT</dt><dd className="text-right tabular-nums">{formatDH(Math.round(q.totalHt))}</dd>
              <dt className="text-muted-foreground">TVA 20 %</dt><dd className="text-right tabular-nums">{formatDH(Math.round(q.totalTtc - q.totalHt))}</dd>
              <dt className="font-semibold">Total TTC</dt><dd className="text-right font-bold tabular-nums" data-testid="devis-total">{formatDH(q.totalTtc)}</dd>
              <dt className="text-muted-foreground">Transport</dt><dd className="text-right">{q.transport}</dd>
            </dl>
            {q.note && <p className="mt-3 rounded-lg border border-border p-3 text-sm"><span className="font-semibold">Message du client :</span> {q.note}</p>}
          </section>

          {status === "à valider" && (
            <section aria-label="Décision" className="flex flex-col gap-4 rounded-2xl border-2 border-amber-500/50 bg-amber-500/8 p-5 sm:flex-row sm:flex-wrap sm:items-start">
              <ValidateButton id={q.id} hint={validateHint} />
              <CancelForm id={q.id} />
            </section>
          )}
          <section aria-labelledby="email" className="rounded-2xl border border-border p-5 text-sm" data-testid="devis-email-panel" data-email-status={q.emailStatus ?? "aucun"}>
            <h2 id="email" className="text-lg font-bold">E-mail au client</h2>
            {!ec.ok && (
              <p className="mt-2 rounded-lg bg-amber-500/12 px-3 py-2 font-medium" data-testid="devis-email-off">
                Email automatique non configuré ({ec.reason}). Envoyez le devis avec le panneau WhatsApp / PDF.
              </p>
            )}
            <dl className="mt-3 grid grid-cols-[9rem_1fr] gap-y-1">
              <dt className="text-muted-foreground">Adresse client</dt>
              <dd data-testid="devis-email-to">{clientEmail ?? (q.email ? `${q.email} (invalide)` : "aucune (téléphone seulement)")}</dd>
              <dt className="text-muted-foreground">Lien privé</dt>
              <dd className="break-all font-mono text-xs" data-testid="devis-private-link">{link}</dd>
              <dt className="text-muted-foreground">Statut</dt>
              <dd data-testid="devis-email-status">
                {q.emailStatus === "envoyé" && q.emailSentAt
                  ? `Envoyé le ${fmtDateTime.format(q.emailSentAt)}${q.emailMessageId ? ` (id ${q.emailMessageId})` : ""}`
                  : q.emailStatus === "échec"
                    ? "Échec de l'envoi"
                    : status === "à valider"
                      ? autoEmail ? "Sera envoyé au clic sur « Valider »" : "Aucun envoi automatique"
                      : "Non envoyé"}
                {q.emailAttempts > 0 && <span className="text-muted-foreground"> · {q.emailAttempts} tentative{q.emailAttempts > 1 ? "s" : ""}</span>}
              </dd>
            </dl>
            {q.emailError && q.emailStatus === "échec" && (
              <p className="mt-3 rounded-lg bg-destructive/12 px-3 py-2 font-medium text-destructive" data-testid="devis-email-error">Dernière erreur : {q.emailError}</p>
            )}
            {autoEmail && (status === "validé" || status === "envoyé") && <ResendEmailButton id={q.id} />}
          </section>

          {status === "validé" && q.number && (
            <section aria-labelledby="envoi" className="rounded-2xl border-2 border-emerald-600/40 p-5">
              <h2 id="envoi" className="mb-4 text-lg font-bold">Envoyer au client {autoEmail ? "(manuellement)" : "par WhatsApp"}</h2>
              <SendPanel id={q.id} number={q.number} message={message} waHref={waClientLink(q.phone, message)} />
              <div className="mt-6 border-t border-border pt-4"><CancelForm id={q.id} /></div>
            </section>
          )}
          {status === "envoyé" && (
            <section className="rounded-2xl border border-border p-5 text-sm">
              <p className="font-semibold" data-testid="devis-envoye-info">Devis envoyé {q.deliveredVia === "email" ? "par e-mail" : "manuellement"}, ligne inscrite au journal.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`/admin/devis/${q.id}/pdf?dl=1`} className="inline-flex h-11 items-center rounded-full bg-primary px-5 font-semibold text-primary-foreground" data-testid="devis-final-download">Télécharger le PDF</a>
                {waClientLink(q.phone, message) && <a href={waClientLink(q.phone, message)!} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center rounded-full border border-border px-5 font-semibold">WhatsApp client</a>}
              </div>
            </section>
          )}
        </div>

        <aside className="lg:col-span-5" aria-labelledby="apercu">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="apercu" className="text-lg font-bold">{final ? "PDF définitif" : "Aperçu brouillon"}</h2>
            <a href={final ? `/admin/devis/${q.id}/pdf` : `/admin/devis/${q.id}/brouillon`} target="_blank" className="text-sm underline" data-testid="devis-preview-link">
              Ouvrir le PDF{final ? "" : " brouillon"}
            </a>
          </div>
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Aperçu du devis en brouillon (sans numéro, non envoyé)" className="w-full rounded-lg border border-border bg-white shadow-sm" data-testid="devis-preview" />
          ) : (
            <p className={cn("rounded-lg border border-border p-4 text-sm text-muted-foreground")}>PDF définitif {q.pdfFile} ({QUOTE_STATUS_LABEL[status] ?? q.status}).</p>
          )}
          {preview && <p className="mt-2 text-xs text-muted-foreground">BROUILLON interne : pas de numéro, jamais visible par le client.</p>}
        </aside>
      </div>
    </div>
  );
}
