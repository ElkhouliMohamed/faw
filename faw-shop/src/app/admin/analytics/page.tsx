import Link from "next/link";
import { analytics, RANGES } from "@/lib/analytics";
import { pageAccess } from "@/lib/admin/perm";
import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const pct = (a: number, b: number) => (b > 0 ? `${Math.round((a / b) * 1000) / 10} %` : "—");

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ j?: string }> }) {
  if (!(await pageAccess("analytics"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const j = Number((await searchParams).j);
  const days = (RANGES as readonly number[]).includes(j) ? j : 30;
  const a = await analytics(days);
  const maxDay = Math.max(1, ...a.daily.map((d) => d.orders + d.quotes));
  const maxVisits = Math.max(1, ...a.daily.map((d) => d.visits));
  const top = a.funnel[0].sessions;
  return (
    <div className="space-y-10" data-testid="analytics">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-mono text-copper">Aperçu</p>
          <h1 className="text-3xl font-extrabold tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Mesure first-party (sans cookie publicitaire ni adresse IP). « Demandes » = commandes du site à confirmer par l&apos;équipe (pas de paiement en ligne).</p>
        </div>
        <nav className="flex gap-1" aria-label="Période">
          {RANGES.map((r) => (
            <Link key={r} href={`?j=${r}`} aria-current={r === days ? "page" : undefined} className={cn("rounded-full px-3 py-1.5 text-sm", r === days ? "bg-foreground text-background" : "border border-border hover:bg-muted")}>{r} j</Link>
          ))}
        </nav>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[2px] border border-border bg-border lg:grid-cols-5">
        {[
          ["Sessions", String(a.totals.visits)],
          ["Demandes", String(a.totals.orders)],
          ["Valeur demandée", formatDH(a.totals.value)],
          ["Gagné", formatDH(a.totals.won)],
          ["Devis générés", String(a.totals.quotes)],
        ].map(([k, v]) => (
          <div key={k} className="bg-card p-4">
            <dt className="label-mono text-[0.62rem] text-muted-foreground">{k}</dt>
            <dd className="mt-1.5 text-xl font-bold tabular-nums" data-testid={`kpi-${k}`}>{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="par-jour">
        <h2 id="par-jour" className="text-xl font-bold">Par jour</h2>
        <p className="text-xs text-muted-foreground">Barres : demandes (cuivre) + devis (gris). Ligne fine : sessions.</p>
        <div className="mt-3 overflow-x-auto rounded-[2px] border border-border bg-card p-3">
          <div className="flex h-40 min-w-[560px] items-end gap-[2px]" role="img" aria-label="Demandes et devis par jour">
            {a.daily.map((d) => (
              <div key={d.day} className="relative flex h-full flex-1 flex-col justify-end" title={`${d.day} : ${d.orders} demande(s), ${d.quotes} devis, ${d.visits} session(s), ${formatDH(d.value)}`}>
                <div className="absolute inset-x-0 bottom-0 border-t border-foreground/30" style={{ height: `${(d.visits / maxVisits) * 100}%` }} />
                <div className="bg-muted-foreground/40" style={{ height: `${(d.quotes / maxDay) * 100}%` }} />
                <div className="bg-copper" style={{ height: `${(d.orders / maxDay) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex min-w-[560px] justify-between text-[0.65rem] text-muted-foreground"><span>{a.daily[0]?.day}</span><span>{a.daily.at(-1)?.day}</span></div>
        </div>
      </section>

      <section aria-labelledby="entonnoir" data-testid="funnel">
        <h2 id="entonnoir" className="text-xl font-bold">Entonnoir de conversion</h2>
        <ol className="mt-3 grid gap-2">
          {a.funnel.map((f) => (
            <li key={f.type} className="grid grid-cols-[minmax(0,12rem)_1fr_auto] items-center gap-3 text-sm" data-testid="funnel-step" data-type={f.type}>
              <span>{f.label}</span>
              <span className="h-3 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-copper" style={{ width: `${top ? Math.max(1, (f.sessions / top) * 100) : 0}%` }} /></span>
              <span className="tabular-nums"><strong data-testid="funnel-count">{f.sessions}</strong> <span className="text-muted-foreground">({pct(f.sessions, top)})</span></span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="sources">
        <h2 id="sources" className="text-xl font-bold">Par source (utm_source)</h2>
        <div className="mt-3 overflow-x-auto rounded-[2px] border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-sm" data-testid="sources-table">
            <thead className="label-mono bg-muted text-[0.62rem] text-muted-foreground">
              <tr><th className="px-3 py-2">Source</th>{a.funnel.map((f) => <th key={f.type} className="px-3 py-2 text-right">{f.label}</th>)}<th className="px-3 py-2 text-right">Conversion</th></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {a.sources.map((s) => (
                <tr key={s.source}><td className="px-3 py-2 font-medium">{s.source}</td>{s.steps.map((n, i) => <td key={i} className="px-3 py-2 text-right tabular-nums">{n}</td>)}<td className="px-3 py-2 text-right">{pct(s.steps[4] + s.steps[5], s.steps[0])}</td></tr>
              ))}
              {!a.sources.length && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Pas encore de données sur la période.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="produits">
          <h2 id="produits" className="text-xl font-bold">Par produit</h2>
          <table className="mt-3 w-full text-left text-sm" data-testid="products-table">
            <thead className="label-mono text-[0.62rem] text-muted-foreground"><tr><th className="py-2">Produit</th><th className="py-2 text-right">Qté</th><th className="py-2 text-right">Valeur</th></tr></thead>
            <tbody className="divide-y divide-border">
              {a.products.map((p) => <tr key={p.id}><td className="py-2"><span className="font-mono text-xs">{p.id}</span> <span className="text-muted-foreground">{p.title}</span></td><td className="py-2 text-right tabular-nums">{p.qty}</td><td className="whitespace-nowrap py-2 text-right">{formatDH(p.value)}</td></tr>)}
              {!a.products.length && <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Aucune demande sur la période.</td></tr>}
            </tbody>
          </table>
        </section>
        <section aria-labelledby="villes">
          <h2 id="villes" className="text-xl font-bold">Par ville</h2>
          <table className="mt-3 w-full text-left text-sm" data-testid="cities-table">
            <thead className="label-mono text-[0.62rem] text-muted-foreground"><tr><th className="py-2">Ville</th><th className="py-2 text-right">Demandes</th><th className="py-2 text-right">Valeur</th><th className="py-2 text-right">Gagné</th></tr></thead>
            <tbody className="divide-y divide-border">
              {a.cities.map((c) => <tr key={c.city}><td className="py-2">{c.city}</td><td className="py-2 text-right tabular-nums">{c.orders}</td><td className="whitespace-nowrap py-2 text-right">{formatDH(c.value)}</td><td className="whitespace-nowrap py-2 text-right">{formatDH(c.won)}</td></tr>)}
              {!a.cities.length && <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">Aucune demande sur la période.</td></tr>}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
