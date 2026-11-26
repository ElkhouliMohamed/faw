import { pageAccess } from "@/lib/admin/perm";
import Link from "next/link";
import { allProducts } from "@/lib/catalog";
import { CATEGORIES, categoryKey, effectiveAvailability } from "@/lib/products";
import { StockRow } from "./stock-row";
import { NewProductForm } from "./new-product";

export const dynamic = "force-dynamic";

export default async function StockPage() {
  if (!(await pageAccess("products"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const all = await allProducts({ includeInactive: true, raw: true });
  const counts = {
    total: all.filter((p) => p.active).length,
    out: all.filter((p) => p.active && effectiveAvailability(p) !== "en stock").length,
    confirm: all.filter((p) => p.active && (p.stockToConfirm || p.priceToConfirm)).length,
  };
  return (
    <div className="space-y-10 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {counts.total} produits en ligne · {counts.out} pas en stock · {counts.confirm} à confirmer (devis automatique bloqué). Les changements sont visibles sur la boutique tout de suite.
          </p>
        </div>
        <a href="#nouveau" className="inline-flex h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">+ Ajouter un produit</a>
      </div>

      {CATEGORIES.map((c) => {
        const list = all.filter((p) => categoryKey(p) === c.key);
        if (!list.length) return null;
        return (
          <section key={c.key} aria-labelledby={`cat-${c.key}`}>
            <h2 id={`cat-${c.key}`} className="mb-3 text-lg font-semibold">{c.label} <span className="text-sm font-normal text-muted-foreground">({list.length})</span></h2>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[56rem] text-sm" data-testid={`stock-table-${c.key}`}>
                <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2.5">Produit</th>
                    <th scope="col" className="px-3 py-2.5">Prix TTC (DH)</th>
                    <th scope="col" className="px-3 py-2.5">Quantité</th>
                    <th scope="col" className="px-3 py-2.5">Disponibilité</th>
                    <th scope="col" className="px-3 py-2.5">En ligne</th>
                    <th scope="col" className="px-3 py-2.5"><span className="sr-only">Enregistrer</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => (
                    <StockRow
                      key={p.id}
                      p={{ id: p.id, slug: p.slug, title: p.title, image: p.image, price: p.price, stockQty: p.stockQty, availability: p.availability, active: p.active, flags: [p.priceToConfirm && "prix à confirmer", p.stockToConfirm && "stock à confirmer"].filter(Boolean) as string[] }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section id="nouveau" aria-labelledby="new-title" className="scroll-mt-6 rounded-2xl border border-border p-5 sm:p-8">
        <h2 id="new-title" className="text-xl font-bold">Ajouter un produit</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nom court (60 caractères max), prix en DH TTC. Pour un produit en plusieurs tailles, indiquez une variante par ligne : chaque taille devient une fiche reliée par le sélecteur de taille.
          Un nouveau produit absent du référentiel devis part en demande à traiter (pas de devis automatique). <Link href="/produits" className="underline">Voir la boutique</Link>
        </p>
        <NewProductForm categories={CATEGORIES.map((c) => c.label)} />
      </section>
    </div>
  );
}
