import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { getDict } from "@/lib/i18n-server";
import { merch } from "@/lib/merch";
import { publicCatalog } from "@/lib/catalog";
import { alternates } from "@/lib/seo";
import { permanentRedirect } from "next/navigation";
import { categoryBySlug } from "@/lib/category-tree";

/** Paramètres de filtre/tri/pagination : la page reste canonique sur /produits, les combinaisons ne sont pas indexées. */
const FILTER_KEYS = ["q", "tri", "page", "categorie", "dispo"];

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }): Promise<Metadata> {
  const sp = await searchParams;
  const filtered = FILTER_KEYS.some((k) => sp[k] != null && sp[k] !== "");
  return {
    title: "Boutique – portes coupe-feu, galandage, incendie",
    description: "Tous les produits FAW Aluminium à Casablanca, prix sur devis : portes coupe-feu EI60, châssis galandage, extincteurs, RIA, kit moteur portail.",
    alternates: await alternates("/produits"),
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  // URL propre : ?categorie=<slug> seul -> 301 vers la page catégorie publiée (/produits/<slug>).
  if (sp.categorie && !sp.q && !sp.tri) {
    const node = await categoryBySlug(sp.categorie);
    if (node) permanentRedirect(sp.lang === "ar" ? `${node.path}?lang=ar` : node.path);
  }
  const { t } = await getDict();
  const m = await merch();
  const cat = m.categories.some((c) => c.active && c.slug === sp.categorie) ? String(sp.categorie) : "all";
  const sort = sp.tri === "prix-croissant" ? "asc" : sp.tri === "prix-decroissant" ? "desc" : "default";
  return (
    <div className="shell pt-10 sm:pt-16">
      <div className="grid-12 items-end gap-y-4 pb-8">
        <div className="col-span-12 lg:col-span-8">
          <p className="eyebrow text-copper">FAW · Casablanca</p>
          <h1 className="mt-3 text-d1">{t.shop.title}</h1>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <p className="max-w-sm text-muted-foreground lg:ms-auto lg:text-end">{t.shop.lead}</p>
        </div>
      </div>
      <div>
        <Catalog key={`${cat}-${sp.q ?? ""}-${sort}`} products={await publicCatalog()} initialCat={cat} initialQ={sp.q ?? ""} initialSort={sort} />
      </div>
    </div>
  );
}
