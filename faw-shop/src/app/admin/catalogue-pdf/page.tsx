import { pageAccess } from "@/lib/admin/perm";
import { allProducts } from "@/lib/catalog";
import { forbidden } from "@/lib/content-rules";

export const dynamic = "force-dynamic";

export default async function CataloguePdfPage() {
  if (!(await pageAccess("catalog-pdf"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const products = await allProducts();
  const blocked = products.filter((p) => forbidden(p.title, p.shortDescription || p.description, p.variantLabel));
  const promos = products.filter((p) => p.compareAt).length;
  return (
    <div className="max-w-3xl" data-testid="catalog-pdf-page">
      <p className="label-mono text-copper">Catalogue</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Catalogue PDF</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Généré à la demande à partir des produits actifs : marque FAW, prix <strong>TTC actifs</strong> (promotions en cours appliquées, ancien prix barré), frais de transport par ville.
        Jamais de prix d&apos;achat, de nom de fournisseur ni de fabricant (le champ « marque » n&apos;est pas imprimé).
      </p>
      <ul className="mt-4 grid gap-1 text-sm">
        <li>{products.length - blocked.length} produit(s) inclus · {promos} en promotion</li>
        {blocked.length > 0 && (
          <li className="text-destructive" data-testid="catalog-pdf-blocked">
            {blocked.length} produit(s) omis car leur texte contient une mention interdite : {blocked.map((p) => p.id).join(", ")}
          </li>
        )}
      </ul>
      <a href="/admin/catalogue-pdf/telecharger" target="_blank" className="mt-6 inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-semibold text-background hover:opacity-90" data-testid="catalog-pdf-download">
        Générer le catalogue PDF
      </a>
    </div>
  );
}
