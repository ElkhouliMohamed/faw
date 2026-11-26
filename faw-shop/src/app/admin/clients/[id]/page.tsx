import Link from "next/link";
import { notFound } from "next/navigation";
import { pageAccess } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { addInteraction, addTask, toggleTask, updateContact, updateLeadStatusForm } from "@/app/actions/crm";
import { INTERACTION_TYPES, LEAD_STATUSES, SUGGESTED_TAGS, fmtDate, fmtDateTime, parseTags, todayBoundsCasablanca } from "@/lib/crm";
import { formatDH } from "@/lib/format";
import { StatusBadge, btnCls, btnGhost, inputCls } from "../../ui";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Ev = { at: Date; kind: string; title: string; detail?: string | null; badge?: string };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await pageAccess("clients"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const c = await prisma.contact.findUnique({
    where: { id },
    include: {
      orders: { orderBy: { createdAt: "desc" }, include: { items: true, events: { orderBy: { createdAt: "asc" } } } },
      interactions: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: [{ done: "asc" }, { dueDate: "asc" }] },
    },
  });
  if (!c) notFound();
  const tags = parseTags(c.tags);
  const ltv = c.orders.filter((o) => o.status === "gagné").reduce((a, o) => a + o.total, 0);
  const { start, end, ymd } = todayBoundsCasablanca();

  const timeline: Ev[] = [
    { at: c.createdAt, kind: "contact", title: "Contact créé", detail: `Source : ${c.utmSource ?? c.source}` },
    ...c.orders.flatMap((o) => [
      { at: o.createdAt, kind: "lead", title: `${o.origin === "manuel" ? "Lead manuel" : "Demande en ligne"} ${o.number} · ${formatDH(o.total)}`, detail: o.items.map((i) => `${i.quantity}× ${i.productId}`).join(", ") || o.notes },
      ...o.events.filter((e) => e.fromStatus).map((e) => ({ at: e.createdAt, kind: "status", title: `${o.number} : ${e.fromStatus} → ${e.toStatus}`, badge: e.toStatus })),
    ]),
    ...c.interactions.map((i) => ({ at: i.createdAt, kind: i.type, title: i.type === "note" ? "Note" : `Interaction · ${i.type}`, detail: i.note })),
    ...c.tasks.map((t) => ({ at: t.createdAt, kind: "task", title: `Relance planifiée : ${t.title}`, detail: `Échéance ${fmtDate.format(t.dueDate)}${t.done ? " · faite" : ""}` })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  return (
    <div>
      <Link href="/admin/clients" className="text-sm text-muted-foreground hover:underline">← Contacts</Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-copper">{c.type}{c.company ? ` · ${c.company}` : ""}</p>
          <h1 className="text-3xl font-extrabold tracking-tight" data-testid="contact-name">{c.name}</h1>
          <p className="mt-1 text-sm" dir="ltr"><a href={`tel:${c.phone}`} className="font-mono hover:underline" data-testid="contact-phone">{c.phone}</a>{c.email && <> · <a href={`mailto:${c.email}`} className="hover:underline">{c.email}</a></>}</p>
          <div className="mt-2 flex flex-wrap gap-1">{tags.map((t) => <span key={t} className="rounded-full border border-border px-2 py-0.5 text-xs" data-testid="contact-tag">{t}</span>)}</div>
        </div>
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-[2px] border border-border bg-border text-sm">
          {[["Valeur (gagné)", formatDH(ltv)], ["Demandes", String(c.orders.length)], ["Dernière activité", fmtDate.format(c.lastActivityAt)]].map(([k, v]) => (
            <div key={k} className="bg-card px-4 py-3"><dt className="label-mono text-[0.6rem] text-muted-foreground">{k}</dt><dd className="mt-1 font-bold" data-testid={k === "Demandes" ? "contact-lead-count" : undefined}>{v}</dd></div>
          ))}
        </dl>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="space-y-8 lg:col-span-7">
          <section aria-labelledby="leads">
            <h2 id="leads" className="text-lg font-bold">Demandes / leads</h2>
            <ul className="mt-3 space-y-2">
              {c.orders.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[2px] border border-border bg-card p-3 text-sm" data-testid="contact-order">
                  <div>
                    <p className="font-mono font-semibold">{o.number} <span className="font-sans font-normal text-muted-foreground">· {fmtDateTime.format(o.createdAt)} · {o.origin}</span></p>
                    <p className="text-xs text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.productId}`).join(", ") || o.notes || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{formatDH(o.total)}</span>
                    <StatusBadge status={o.status} />
                    <form action={updateLeadStatusForm} className="flex gap-1">
                      <input type="hidden" name="orderId" value={o.id} />
                      <select name="status" defaultValue={o.status} aria-label={`Statut ${o.number}`} className="h-8 rounded border border-input bg-background px-1 text-xs">
                        {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <button className="h-8 rounded border border-border px-2 text-xs hover:bg-muted">OK</button>
                    </form>
                  </div>
                </li>
              ))}
              {c.orders.length === 0 && <li className="text-sm text-muted-foreground">Aucune demande.</li>}
            </ul>
          </section>

          <section aria-labelledby="timeline">
            <h2 id="timeline" className="text-lg font-bold">Historique</h2>
            <ol className="relative mt-4 space-y-4 border-s border-border ps-6" data-testid="timeline">
              {timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className={cn("absolute -start-[29px] top-1.5 size-2.5 rounded-full ring-4 ring-background", e.kind === "status" ? "bg-violet-500" : e.kind === "lead" ? "bg-copper" : e.kind === "task" ? "bg-amber-500" : "bg-foreground/50")} aria-hidden />
                  <p className="text-xs text-muted-foreground">{fmtDateTime.format(e.at)}</p>
                  <p className="text-sm font-medium">{e.title}</p>
                  {e.detail && <p className="text-sm whitespace-pre-line text-muted-foreground">{e.detail}</p>}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6 lg:col-span-5">
          <section aria-labelledby="tasks" className="rounded-[2px] border border-border bg-card p-4">
            <h2 id="tasks" className="font-bold">Relances</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {c.tasks.map((t) => {
                const late = !t.done && t.dueDate < start;
                const today = !t.done && t.dueDate >= start && t.dueDate < end;
                return (
                  <li key={t.id} className="flex items-center gap-3" data-testid="task-item">
                    <form action={toggleTask}>
                      <input type="hidden" name="taskId" value={t.id} />
                      <button aria-pressed={t.done} aria-label={t.done ? `Rouvrir « ${t.title} »` : `Marquer « ${t.title} » comme faite`} className={cn("grid size-5 place-items-center rounded-full border-2 text-[0.6rem]", t.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-border hover:border-copper")}>{t.done ? "✓" : ""}</button>
                    </form>
                    <span className={cn("flex-1", t.done && "text-muted-foreground line-through")}>{t.title}</span>
                    <span className={cn("text-xs", late ? "font-semibold text-destructive" : today ? "font-semibold text-copper" : "text-muted-foreground")}>{today ? "Aujourd'hui" : fmtDate.format(t.dueDate)}</span>
                  </li>
                );
              })}
            </ul>
            <form action={addTask} className="mt-4 grid grid-cols-[1fr_auto] gap-2">
              <input type="hidden" name="contactId" value={c.id} />
              <input name="title" required placeholder="Ex. relancer pour le devis" aria-label="Titre de la relance" className={`${inputCls} col-span-2`} />
              <input name="dueDate" type="date" required defaultValue={ymd} aria-label="Échéance" className={inputCls} />
              <button className={btnCls}>Ajouter</button>
            </form>
          </section>

          <section aria-labelledby="interaction" className="rounded-[2px] border border-border bg-card p-4">
            <h2 id="interaction" className="font-bold">Ajouter une interaction</h2>
            <form action={addInteraction} className="mt-3 space-y-2">
              <input type="hidden" name="contactId" value={c.id} />
              <fieldset className="flex flex-wrap gap-1.5">
                <legend className="sr-only">Type</legend>
                {INTERACTION_TYPES.map((t, i) => (
                  <label key={t} className="cursor-pointer">
                    <input type="radio" name="type" value={t} defaultChecked={i === 0} className="peer sr-only" />
                    <span className="inline-flex rounded-full border border-border px-3 py-1 text-xs font-medium peer-checked:border-foreground peer-checked:bg-foreground peer-checked:text-background peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40">{t === "whatsapp" ? "WhatsApp" : t}</span>
                  </label>
                ))}
              </fieldset>
              <textarea name="note" rows={3} placeholder="Compte rendu, montant du devis, prochaine étape…" aria-label="Note" className={`${inputCls} h-auto py-2`} />
              <button className={btnCls}>Enregistrer</button>
            </form>
          </section>

          <section aria-labelledby="fiche" className="rounded-[2px] border border-border bg-card p-4">
            <h2 id="fiche" className="font-bold">Fiche</h2>
            <form action={updateContact} className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <input type="hidden" name="contactId" value={c.id} />
              <label className="col-span-2">Nom<input name="name" defaultValue={c.name} required className={inputCls} /></label>
              <label>E-mail<input name="email" type="email" defaultValue={c.email ?? ""} className={inputCls} /></label>
              <label>Ville<input name="city" defaultValue={c.city ?? ""} className={inputCls} /></label>
              <label>Type<select name="type" defaultValue={c.type} className={inputCls}><option value="particulier">particulier</option><option value="entreprise">entreprise</option></select></label>
              <label>ICE<input name="ice" defaultValue={c.ice ?? ""} className={inputCls} /></label>
              <label className="col-span-2">Société<input name="company" defaultValue={c.company ?? ""} className={inputCls} /></label>
              <label className="col-span-2">Tags (séparés par des virgules)<input name="tags" defaultValue={tags.join(", ")} list="tag-suggestions" className={inputCls} data-testid="tags-input" /></label>
              <datalist id="tag-suggestions">{SUGGESTED_TAGS.map((t) => <option key={t} value={t} />)}</datalist>
              <p className="col-span-2 text-xs text-muted-foreground">Suggestions : {SUGGESTED_TAGS.join(", ")}</p>
              <button className={`${btnGhost} col-span-2`}>Enregistrer la fiche</button>
            </form>
            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
              <div><dt className="inline font-semibold">Premier contact : </dt><dd className="inline">{fmtDateTime.format(c.createdAt)} · {c.source}</dd></div>
              {(c.utmSource || c.utmMedium || c.utmCampaign) && <div><dt className="inline font-semibold">UTM : </dt><dd className="inline">{[c.utmSource, c.utmMedium, c.utmCampaign].filter(Boolean).join(" / ")}</dd></div>}
              {c.gclid && <div><dt className="inline font-semibold">gclid : </dt><dd className="inline break-all">{c.gclid}</dd></div>}
              {c.fbclid && <div><dt className="inline font-semibold">fbclid : </dt><dd className="inline break-all">{c.fbclid}</dd></div>}
              {c.landing && <div><dt className="inline font-semibold">Page d&apos;arrivée : </dt><dd className="inline break-all">{c.landing}</dd></div>}
              {c.referrer && <div><dt className="inline font-semibold">Référent : </dt><dd className="inline break-all">{c.referrer}</dd></div>}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
