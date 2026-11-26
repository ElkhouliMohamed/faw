import Link from "next/link";
import { notFound } from "next/navigation";
import { delegate, entityDef } from "@/lib/admin/entities";
import { cellValue, searchWhere } from "@/lib/admin/crud-view";
import { pageAccess } from "@/lib/admin/perm";
import { readRedirectHits } from "@/lib/redirects";
import { btnCls, btnGhost, inputCls } from "../../ui";
import { RedirectImport } from "./redirect-import";

export const dynamic = "force-dynamic";

export default async function EntityList({ params, searchParams }: { params: Promise<{ entity: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { entity } = await params;
  const e = entityDef(entity);
  if (!e) notFound();
  const acc = await pageAccess(e.perm);
  if (!acc) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 80);
  const size = e.pageSize ?? 50;
  const page = Math.max(1, Math.min(10_000, Number.parseInt(sp.p ?? "1", 10) || 1));
  const where = searchWhere(e, q);
  const db = delegate(e);
  const [rows, total] = await Promise.all([db.findMany({ where, orderBy: e.orderBy, skip: (page - 1) * size, take: size }), db.count({ where })]);
  const hits = e.key === "redirects" ? await readRedirectHits() : null;
  const pages = Math.max(1, Math.ceil(total / size));
  const qs = (p: number) => `?${new URLSearchParams({ ...(q ? { q } : {}), p: String(p) })}`;
  const canCreate = acc.write && e.create !== false;
  return (
    <div data-testid={`entity-${e.key}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-mono text-copper">Back-office</p>
          <h1 className="text-3xl font-extrabold tracking-tight">{e.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="entity-count">{total} élément(s){acc.write ? "" : " · lecture seule"}</p>
        </div>
        {canCreate && (
          <Link href={`/admin/m/${e.key}/nouveau`} className={btnCls} data-testid="entity-new">+ Ajouter {e.singular}</Link>
        )}
      </div>
      {e.warning && <p className="mt-4 rounded-[2px] border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="note" data-testid="entity-warning">{e.warning}</p>}
      {e.intro && <p className="mt-3 max-w-3xl text-sm text-muted-foreground">{e.intro}</p>}
      {sp.deleted && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" role="status">Supprimé.</p>}
      {sp.imported && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300" role="status" data-testid="import-result">{sp.imported}</p>}
      {e.key === "redirects" && acc.write && <RedirectImport />}

      {e.search.length > 0 && (
        <form className="mt-5 flex max-w-xl gap-2" role="search">
          <input name="q" defaultValue={q} placeholder="Rechercher…" aria-label="Rechercher" className={inputCls} data-testid="entity-search" />
          <button className={btnGhost}>Rechercher</button>
        </form>
      )}

      <div className="relative mt-4 overflow-x-auto rounded-[2px] border border-border bg-card">
        <table className="w-full min-w-[640px] text-left text-sm" data-testid="entity-table">
          <thead className="label-mono bg-muted text-[0.65rem] text-muted-foreground">
            <tr>
              {e.columns.map((c) => <th key={c.name} className="px-3 py-3">{c.label}</th>)}
              {hits && <th className="px-3 py-3 text-right">Visites</th>}
              <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const href = `/admin/m/${e.key}/${encodeURIComponent(String(r.id))}`;
              return (
                <tr key={String(r.id)} data-testid="entity-row" data-id={String(r.id)}>
                  {e.columns.map((c, i) => {
                    const v = cellValue(c, r);
                    const cls = v.kind === "mono" ? "font-mono text-xs" : v.kind === "money" ? "whitespace-nowrap" : "";
                    return (
                      <td key={c.name} className={`max-w-[28rem] break-words px-3 py-2.5 ${cls}`}>
                        {i === 0 && e.edit !== false ? <Link href={href} className="font-semibold hover:underline">{v.text}</Link> : v.kind === "badge" ? <span className="rounded-full border border-border px-2 py-0.5 text-xs">{v.text}</span> : v.text}
                      </td>
                    );
                  })}
                  {hits && <td className="px-3 py-2.5 text-right tabular-nums" data-testid="redirect-hits">{hits[String(r.from)]?.n ?? 0}</td>}
                  <td className="px-3 py-2.5 text-right">{e.edit !== false && <Link href={href} className="text-xs font-semibold text-copper hover:underline">{acc.write ? "Modifier" : "Voir"}</Link>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={e.columns.length + 2} className="px-3 py-8 text-center text-muted-foreground" data-testid="entity-empty">Aucun élément{q ? " pour cette recherche" : ""}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Pagination">
          {page > 1 && <Link className={btnGhost} href={qs(page - 1)}>Précédent</Link>}
          <span>Page {page} / {pages}</span>
          {page < pages && <Link className={btnGhost} href={qs(page + 1)}>Suivant</Link>}
        </nav>
      )}
    </div>
  );
}
