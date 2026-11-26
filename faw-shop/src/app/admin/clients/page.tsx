import Link from "next/link";
import { pageAccess } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { findContacts, readFilters } from "@/lib/crm-query";
import { LEAD_STATUSES, SUGGESTED_TAGS, fmtDate, parseTags } from "@/lib/crm";
import { formatDH } from "@/lib/format";
import { btnCls, btnGhost, inputCls } from "../ui";

export const dynamic = "force-dynamic";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (!(await pageAccess("clients"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const f = readFilters(await searchParams);
  const [rows, all] = await Promise.all([findContacts(f), prisma.contact.findMany({ select: { tags: true, city: true } })]);
  const tags = [...new Set([...SUGGESTED_TAGS, ...all.flatMap((c) => parseTags(c.tags))])];
  const cities = [...new Set(all.map((c) => c.city).filter(Boolean) as string[])].sort();
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-copper">Clients</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Contacts</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="contacts-count">{rows.length} contact(s)</p>
        </div>
        <div className="flex gap-2">
          <a href={`/admin/clients/export${qs ? `?${qs}` : ""}`} className={btnGhost} data-testid="csv-export">Exporter CSV</a>
          <Link href="/admin/clients/nouveau" className={btnCls}>+ Nouveau contact / lead</Link>
        </div>
      </div>

      <form className="mt-6 grid gap-2 rounded-[2px] border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Filtrer les contacts">
        <input name="q" defaultValue={f.q} placeholder="Nom, société, téléphone, ICE…" aria-label="Recherche" className={`${inputCls} lg:col-span-2`} data-testid="contacts-search" />
        <select name="tag" defaultValue={f.tag ?? ""} aria-label="Tag" className={inputCls}>
          <option value="">Tous les tags</option>
          {tags.map((t) => <option key={t}>{t}</option>)}
        </select>
        <select name="type" defaultValue={f.type ?? ""} aria-label="Type" className={inputCls}>
          <option value="">Tous types</option>
          <option value="particulier">Particulier</option>
          <option value="entreprise">Entreprise</option>
        </select>
        <select name="city" defaultValue={f.city ?? ""} aria-label="Ville" className={inputCls}>
          <option value="">Toutes villes</option>
          {cities.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div className="flex gap-2">
          <select name="statut" defaultValue={f.statut ?? ""} aria-label="Statut d'une demande" className={inputCls}>
            <option value="">Tout statut</option>
            {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className={btnCls}>Filtrer</button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto rounded-[2px] border border-border bg-card">
        <table className="w-full min-w-[900px] text-left text-sm" data-testid="contacts-table">
          <thead className="label-mono bg-muted text-[0.65rem] text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Téléphone</th>
              <th className="px-3 py-3">Ville</th>
              <th className="px-3 py-3">Tags</th>
              <th className="px-3 py-3">Source</th>
              <th className="px-3 py-3 text-right">Demandes</th>
              <th className="px-3 py-3 text-right">Valeur (gagné)</th>
              <th className="px-3 py-3">Dernière activité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => (
              <tr key={c.id} data-testid="contact-row" data-phone={c.phone}>
                <td className="px-3 py-3">
                  <Link href={`/admin/clients/${c.id}`} className="font-semibold hover:underline">{c.name}</Link>
                  <p className="text-xs text-muted-foreground">{c.type}{c.company ? ` · ${c.company}` : ""}</p>
                </td>
                <td className="px-3 py-3 font-mono text-xs" dir="ltr">{c.phone}</td>
                <td className="px-3 py-3">{c.city ?? "—"}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{c.tagList.map((t) => <span key={t} className="rounded-full border border-border px-2 py-0.5 text-[0.7rem]">{t}</span>)}</div></td>
                <td className="px-3 py-3 text-xs">{c.utmSource ?? (c.gclid ? "google" : c.fbclid ? "meta" : c.source)}</td>
                <td className="px-3 py-3 text-right" data-testid="contact-leads">{c.leads}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatDH(c.ltv)}</td>
                <td className="px-3 py-3 text-xs text-muted-foreground">{fmtDate.format(c.lastActivityAt)}{c.openTasks ? ` · ${c.openTasks} relance(s)` : ""}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">Aucun contact.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
