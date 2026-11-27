import "server-only";
import { cache } from "react";
import { z } from "zod";
import { parseBlocks } from "./blocks";
import { publicJson } from "./shop-api";

// Pages CMS (pages, technologies, blog) lues via l'API Laravel, en cache Next (étiquette "content", vidée par Filament).
const contentSchema = z.object({
  kind: z.enum(["home", "page", "technology", "blog"]),
  slug: z.string(),
  title: z.string(),
  excerpt: z.string().nullable(),
  bodyHtml: z.string().nullable(),
  blocks: z.array(z.unknown()),
  image: z.string().nullable(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updated_at: z.string(),
  featuredProductId: z.string().nullable(),
  ctaLabel: z.string().nullable(),
  ctaUrl: z.string().nullable(),
  defaultSections: z.boolean(),
});
export type ContentPage = z.infer<typeof contentSchema>;

const SLUG = /^[a-z0-9-]{1,160}$/;

/** Page publiée, ou null. Un seul appel par rendu (métadonnées + page) grâce à React cache(). */
export const contentPage = cache(async function contentPage(kind: ContentPage["kind"], slug: string): Promise<ContentPage | null> {
  if (!SLUG.test(slug)) return null;
  const parsed = contentSchema.safeParse(await publicJson(`/api/content/${kind}/${encodeURIComponent(slug)}`, "content", 5000));
  return parsed.success ? parsed.data : null;
});

export const contentBlocks = (p: ContentPage | null) => parseBlocks(JSON.stringify(p?.blocks || []));

const postsSchema = z.object({ data: z.array(contentSchema), last_page: z.number(), current_page: z.number() });
const EMPTY_POSTS = { data: [] as ContentPage[], last_page: 1, current_page: 1 };
const TAXONOMY_SLUG = /^[a-z0-9-]{1,80}$/;

export const blogPosts = cache(async function blogPosts(category?: string, tag?: string, page = 1) {
  const search = new URLSearchParams({ page: String(Math.min(500, Math.max(1, Math.floor(page) || 1))) });
  if (category && TAXONOMY_SLUG.test(category)) search.set("category", category);
  if (tag && TAXONOMY_SLUG.test(tag)) search.set("tag", tag);
  const parsed = postsSchema.safeParse(await publicJson(`/api/blog?${search}`, "content", 5000));
  return parsed.success ? parsed.data : EMPTY_POSTS;
});

const taxonomySchema = z.object({ id: z.number(), slug: z.string(), label: z.string() });
export const blogTaxonomies = cache(async function blogTaxonomies() {
  const parsed = z.object({ categories: z.array(taxonomySchema), tags: z.array(taxonomySchema) }).safeParse(await publicJson("/api/blog-taxonomies", "content", 5000));
  return parsed.success ? parsed.data : { categories: [], tags: [] };
});

/** Pages publiées pour le sitemap. */
export async function contentLinks() {
  const parsed = z.array(z.object({ kind: z.enum(["page", "technology", "blog"]), slug: z.string(), updated_at: z.string() })).safeParse(await publicJson("/api/content-links", "content", 5000));
  return parsed.success ? parsed.data : [];
}
