import "server-only";
import { cache } from "react";
import { merch } from "./merch";
import { CATEGORY_LANDINGS, type CategoryLanding } from "./category-pages";
import { CATEGORIES, type CategoryKey, type Faq, type Product } from "./products";
import { allProducts } from "./catalog";
import { stripPriceMentions } from "./format";

/**
 * Arbre des catégories publiées (Laravel : Category.parentId, Category.active = publiée).
 * Une catégorie est publique seulement si elle ET tous ses parents sont publiés.
 * URL propre unique : /produits/<pageSlug> (slug historique de la page d'atterrissage s'il existe).
 */
export type CatNode = {
  id: number;
  slug: string;
  pageSlug: string;
  path: string;
  label: string;
  short: string;
  family: CategoryKey;
  h1: string;
  title: string;
  description: string;
  intro: string[];
  faq: Faq[];
  image: string | null;
  parentId: number | null;
  landing: CategoryLanding | null;
};

const famOf = (f: string): CategoryKey => (CATEGORIES.some((c) => c.key === f) ? (f as CategoryKey) : "incendie");
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);

export const categoryTree = cache(async function categoryTree() {
  const m = await merch();
  const rows = m.categories;
  const byId = new Map(rows.map((r) => [r.id, r]));
  const published = (id: number, seen = new Set<number>()): boolean => {
    const r = byId.get(id);
    if (!r || !r.active || seen.has(id)) return false;
    seen.add(id);
    return r.parentId == null || published(r.parentId, seen);
  };
  const productSlugs = new Set((await allProducts()).map((p) => p.slug));
  const nodes: CatNode[] = rows
    .filter((r) => published(r.id))
    .map((r) => {
      const landing = CATEGORY_LANDINGS.find((l) => l.slug === r.slug || (l.key === r.slug && r.parentId == null)) ?? null;
      let pageSlug = landing?.slug ?? r.slug;
      if (!landing && productSlugs.has(pageSlug)) pageSlug = `categorie-${pageSlug}`;
      const label = r.label;
      const h1 = r.h1?.trim() || landing?.h1 || `${label} à Casablanca`;
      const title = r.seoTitle?.trim() || landing?.title || clip(`${label} à Casablanca – prix sur devis`, 60);
      const description = stripPriceMentions(
        r.seoDescription?.trim() || landing?.description || clip(`${label} chez FAW Aluminium à Casablanca. ${r.description?.trim() || r.short?.trim() || ""} Prix sur devis, devis PDF en ligne.`.replace(/\s{2,}/g, " "), 160),
      );
      const intro = landing?.intro ?? (r.description?.trim() ? r.description.trim().split(/\n{2,}/) : []);
      return {
        id: r.id, slug: r.slug, pageSlug, path: `/produits/${pageSlug}`, label, short: r.short || label, family: famOf(r.family),
        h1, title, description, intro, faq: landing?.faq ?? [], image: r.image ?? null, parentId: r.parentId ?? null, landing,
      };
    });
  const ids = new Set(nodes.map((n) => n.id));
  for (const n of nodes) if (n.parentId != null && !ids.has(n.parentId)) n.parentId = null;
  return nodes;
});

export async function categoryByPageSlug(slug: string) {
  return (await categoryTree()).find((n) => n.pageSlug === slug.toLowerCase()) ?? null;
}
export async function categoryBySlug(slug: string) {
  return (await categoryTree()).find((n) => n.slug === slug) ?? null;
}
export async function categoryForProduct(p: Pick<Product, "category">) {
  const m = await merch();
  const row = m.categories.find((c) => c.label === p.category);
  return row ? (await categoryTree()).find((n) => n.id === row.id) ?? null : null;
}
export async function childrenOf(n: CatNode) {
  return (await categoryTree()).filter((c) => c.parentId === n.id);
}
/** Chaîne racine → catégorie (pour fil d'Ariane). */
export async function ancestry(n: CatNode) {
  const all = await categoryTree();
  const chain: CatNode[] = [n];
  let cur = n;
  while (cur.parentId != null && chain.length < 8) {
    const parent = all.find((c) => c.id === cur.parentId);
    if (!parent) break;
    chain.unshift(parent);
    cur = parent;
  }
  return chain;
}
/** Produits de la catégorie et de ses sous-catégories publiées. */
export async function productsUnder(n: CatNode) {
  const all = await categoryTree();
  const labels = new Set<string>();
  const walk = (c: CatNode) => {
    labels.add(c.label);
    all.filter((x) => x.parentId === c.id).forEach(walk);
  };
  walk(n);
  return (await allProducts()).filter((p) => labels.has(p.category));
}
/** Lien interne vers la catégorie d'une famille (URL propre si publiée). */
export async function familyHref(key: CategoryKey) {
  const all = await categoryTree();
  return (all.find((c) => c.slug === key && c.parentId == null) ?? all.find((c) => c.family === key && c.parentId == null))?.path ?? "/produits";
}
