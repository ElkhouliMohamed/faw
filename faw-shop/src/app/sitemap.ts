import {publicConfig} from "@/lib/public-config";
import type { MetadataRoute } from "next";
import { allProducts } from "@/lib/catalog";
import { shopLandings } from "@/lib/shop-api";
import { contentLinks } from "@/lib/content";
import { categoryTree } from "@/lib/category-tree";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const config=await publicConfig();if(config?.seo.sitemapEnabled===false)return []; // v6 : liste toujours toutes les fiches ; un aperçu « noindex » reste bloqué par robots.txt et la balise meta
  const origin=config?.seo.canonicalBase?.replace(/\/$/,"") || SITE.url;
  const alt = (path: string) => {
    const cleanPath = path === "/" ? "" : path;
    const frUrl = `${origin}/fr${cleanPath}`;
    const arUrl = `${origin}/ar${cleanPath}`;
    return {
      languages: {
        "fr-MA": frUrl,
        "ar-MA": arUrl,
        "fr": frUrl,
        "ar": arUrl,
        "x-default": frUrl,
      },
    };
  };
  const entry = (path: string, priority: number, lastModified?: Date) => {
    const cleanPath = path === "/" ? "" : path;
    return {
      url: `${origin}/fr${cleanPath}`,
      changeFrequency: "weekly" as const,
      priority,
      alternates: alt(cleanPath),
      ...(lastModified ? { lastModified } : {}),
    };
  };
  const pages = [entry("", 1), entry("/produits", 0.9), entry("/devis", 0.7), entry("/livraison", 0.5), entry("/contact", 0.5)];
  // catégories publiées uniquement (elle et ses parents), URL propre
  const cats = (await categoryTree()).map((c) => entry(c.path, c.parentId == null ? 0.9 : 0.85));
  const products = (await allProducts()).map((p) => entry(`/produits/${p.slug}`, 0.8, p.updatedAt));
  const extra = [entry("/packs", 0.6)];
  const landings = (await shopLandings()).map((l) => entry(`/l/${l.slug}`, 0.6, l.updatedAt ? new Date(l.updatedAt) : undefined));
  const links=await contentLinks();
  const content=links.map(c=>entry(`/${c.kind==="page"?"pages":c.kind==="technology"?"technologies":"blog"}/${c.slug}`,0.5,new Date(c.updated_at)));
  return [...content,...pages, ...extra, ...cats, ...products, ...landings];
}
