import Image from "next/image";
import { Blocks } from "@/components/blocks";
import { allProducts } from "@/lib/catalog";
import { showPublicPrices } from "@/lib/price-visibility";
import { stripPriceMentions } from "@/lib/format";
import { contentBlocks, type ContentPage } from "@/lib/content";
import { articleLd, ldJson, nonce } from "@/lib/seo";

export async function ContentView({ page }: { page: ContentPage }) {
  const blocks = contentBlocks(page);
  const products = await allProducts();
  const n = await nonce();
  const showPrices = await showPublicPrices();

  return (
    <article className="pb-20">
      <header className="shell max-w-4xl pt-10">
        <h1 className="text-d1 break-words">{page.title}</h1>
        {page.excerpt && <p className="mt-6 text-lead text-muted-foreground">{showPrices ? page.excerpt : stripPriceMentions(page.excerpt)}</p>}
        {page.image && (
          <div className="relative mt-8 aspect-[16/9] overflow-hidden rounded-lg">
            <Image src={page.image} alt={page.title} fill priority sizes="(min-width:1024px) 900px, 100vw" className="object-cover" />
          </div>
        )}
      </header>
      {page.bodyHtml && (
        <div
          className="shell mt-8 max-w-4xl break-words leading-relaxed [&_p]:my-4 [&_h2]:mt-8 [&_h2]:text-d3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_a]:underline [&_table]:block [&_table]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: showPrices ? page.bodyHtml : stripPriceMentions(page.bodyHtml) }}
        />
      )}
      <Blocks blocks={blocks} products={products} hasH1 showPrices={showPrices} />
      {page.kind === "blog" && (
        <script
          type="application/ld+json"
          nonce={n}
          dangerouslySetInnerHTML={ldJson(
            articleLd({
              title: page.title,
              description: page.excerpt || page.seoDescription || undefined,
              slug: page.slug,
              image: page.image ?? undefined,
              publishedAt: page.publishedAt ?? undefined,
              updatedAt: page.updated_at,
            }),
          )}
        />
      )}
    </article>
  );
}
