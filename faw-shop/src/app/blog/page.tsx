import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { blogPosts, blogTaxonomies } from "@/lib/content";
import { noindexMeta, alternates } from "@/lib/seo";
import { cn } from "@/lib/utils";

type Search = { category?: string; tag?: string; page?: string };

/** Blog vide (aucun article publié) ou filtré : non indexé, pas de hreflang. */
export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const s = await searchParams;
  const posts = await blogPosts(undefined, undefined, 1);
  if (!posts.data.length || s.category || s.tag || (Number(s.page) || 1) > 1) return noindexMeta("/blog", "Blog FAW", "Articles FAW Aluminium.");
  return { title: "Blog FAW", description: "Articles FAW Aluminium.", alternates: await alternates("/blog") };
}

const dateFr = (iso: string | null) => (iso ? new Intl.DateTimeFormat("fr-MA", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso)) : null);

export default async function Blog({ searchParams }: { searchParams: Promise<Search> }) {
  const s = await searchParams;
  const [posts, tax] = await Promise.all([blogPosts(s.category, s.tag, Number(s.page) || 1), blogTaxonomies()]);
  const params = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    if (s.category) q.set("category", s.category);
    if (s.tag) q.set("tag", s.tag);
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `/blog?${q}`;
  };
  const chip = (activeChip: boolean) =>
    cn("inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors", activeChip ? "border-foreground bg-foreground text-background" : "border-rule hover:border-foreground/40");
  const filtered = !!(s.category || s.tag);

  return (
    <section className="shell section-y">
      <p className="eyebrow text-copper">FAW Aluminium</p>
      <h1 className="mt-3 text-d1">Blog FAW</h1>
      {(tax.categories.length > 0 || tax.tags.length > 0) && (
        <nav className="no-scrollbar -mx-4 mt-8 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Catégories et étiquettes">
          <ul className="flex gap-2 sm:flex-wrap">
            <li className="shrink-0"><Link href="/blog" className={chip(!filtered)}>Tous</Link></li>
            {tax.categories.map((c) => (
              <li key={`c${c.id}`} className="shrink-0"><Link className={chip(s.category === c.slug)} href={`/blog?category=${encodeURIComponent(c.slug)}`}>{c.label}</Link></li>
            ))}
            {tax.tags.map((t) => (
              <li key={`t${t.id}`} className="shrink-0"><Link className={chip(s.tag === t.slug)} href={`/blog?tag=${encodeURIComponent(t.slug)}`}>#{t.label}</Link></li>
            ))}
          </ul>
        </nav>
      )}
      {!posts.data.length ? (
        <p className="mt-10 text-muted-foreground">Aucun article pour le moment.</p>
      ) : (
        <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {posts.data.map((p, i) => (
            <li key={p.slug}>
              <article className="group flex h-full flex-col">
                <Link href={`/blog/${p.slug}`} tabIndex={-1} aria-hidden className="relative block aspect-[16/10] overflow-hidden rounded-lg bg-sand">
                  {p.image && <Image src={p.image} alt="" fill priority={i < 2} sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 92vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />}
                </Link>
                {dateFr(p.publishedAt) && <p className="mt-4 text-xs text-muted-foreground">{dateFr(p.publishedAt)}</p>}
                <h2 className="mt-2 text-d3">
                  <Link href={`/blog/${p.slug}`} className="hover:text-copper">{p.title}</Link>
                </h2>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-muted-foreground">{p.excerpt}</p>}
                <Link className="mt-3 inline-flex min-h-11 items-center gap-1 self-start font-semibold text-copper" href={`/blog/${p.slug}`}>
                  Lire <span className="sr-only">: {p.title}</span> <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
      {(posts.current_page > 1 || posts.current_page < posts.last_page) && (
        <nav className="mt-12 flex justify-between gap-6 border-t border-rule pt-6" aria-label="Pagination">
          {posts.current_page > 1 ? <Link className="btn btn-ghost" href={params({ page: String(posts.current_page - 1) })}>Précédent</Link> : <span />}
          {posts.current_page < posts.last_page && <Link className="btn btn-ghost" href={params({ page: String(posts.current_page + 1) })}>Suivant</Link>}
        </nav>
      )}
    </section>
  );
}
