import Link from "next/link";
import { notFound } from "next/navigation";
import { delegate, entityDef, fieldsOf, parseId } from "@/lib/admin/entities";
import { formValues } from "@/lib/admin/crud-view";
import { pageAccess } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { CrudForm } from "@/components/admin/crud-form";

export const dynamic = "force-dynamic";

export default async function EntityEdit({ params, searchParams }: { params: Promise<{ entity: string; id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { entity, id: rawId } = await params;
  const e = entityDef(entity);
  if (!e) notFound();
  const acc = await pageAccess(e.perm);
  if (!acc) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const isCreate = rawId === "nouveau";
  if (isCreate && (e.create === false || !acc.write)) notFound();
  if (!isCreate && e.edit === false) notFound();
  const id = isCreate ? null : parseId(e, decodeURIComponent(rawId));
  if (!isCreate && id == null) notFound();
  const row = id == null ? null : await delegate(e).findUnique({ where: { id } });
  if (!isCreate && !row) notFound();
  const fields = await fieldsOf(e);
  const src = row ? (e.toForm ? await e.toForm(row) : row) : { active: true, published: false };
  const values = formValues(fields, src);
  const needsMedia = fields.some((f) => f.type === "image" || f.type === "blocks");
  const media = needsMedia ? (await prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 200, select: { url: true, alt: true } })).map((m) => ({ url: m.url, alt: m.alt })) : [];
  const sp = await searchParams;
  const pub = row && e.publicHref ? e.publicHref(row) : null;
  const name = row ? String(row.label ?? row.name ?? row.title ?? row.code ?? row.from ?? row.email ?? row.id) : null;
  return (
    <div className="max-w-3xl">
      <Link href={`/admin/m/${e.key}`} className="text-sm text-muted-foreground hover:underline">← {e.title}</Link>
      <h1 className="mt-2 break-words text-2xl font-extrabold tracking-tight">{isCreate ? `Ajouter ${e.singular}` : name}</h1>
      {pub && <a href={pub} target="_blank" rel="noopener" className="mt-1 inline-block text-sm text-copper hover:underline" data-testid="entity-public-link">Voir sur le site ↗</a>}
      {e.warning && <p className="mt-4 rounded-[2px] border border-amber-500/40 bg-amber-500/10 p-3 text-sm" role="note" data-testid="entity-warning">{e.warning}</p>}
      {sp.saved && <p className="mt-4 rounded-[2px] border border-emerald-600/30 bg-emerald-600/10 p-3 text-sm" role="status" data-testid="entity-saved">Enregistré.</p>}
      <CrudForm
        entity={e.key}
        id={isCreate ? "nouveau" : String(id)}
        fields={fields}
        values={values}
        media={media}
        readOnly={!acc.write}
        canDelete={!isCreate && acc.write && e.remove === "delete"}
        isCreate={isCreate}
      />
    </div>
  );
}
