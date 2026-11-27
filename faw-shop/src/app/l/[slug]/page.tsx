import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Blocks, blocksFaq } from "@/components/blocks";
import { parseBlocks } from "@/lib/blocks";
import { allProducts } from "@/lib/catalog"
import { showPublicPrices } from "@/lib/price-visibility"
import { stripPriceMentions } from "@/lib/format";
import { shopLanding } from "@/lib/shop-api";
import { alternates, breadcrumbLd, faqLd, ldJson, nonce } from "@/lib/seo";

// Rendu à la demande (le layout lit la langue et le nonce CSP) ; données servies par le cache Next ("landings", "catalog").
const load = (slug: string) => shopLanding(slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const l = await load((await params).slug);
  if (!l) return {};
  const showPrices = await showPublicPrices();
  const desc = l.seoDescription ? (showPrices ? l.seoDescription : stripPriceMentions(l.seoDescription)) : undefined;
  const alt = await alternates(`/l/${l.slug}`);
  return {
    title: l.seoTitle ? { absolute: showPrices ? l.seoTitle : stripPriceMentions(l.seoTitle) } : l.title,
    description: desc,
    alternates: alt,
    openGraph: {
      title: l.seoTitle || l.title,
      description: desc,
      url: alt.canonical,
      type: "website",
    },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const l = await load((await params).slug);
  if (!l) notFound();
  const showPrices = await showPublicPrices();
  const blocks = parseBlocks(JSON.stringify(l.blocks));
  const faq = showPrices ? blocksFaq(blocks) : blocksFaq(blocks).map((f) => ({ q: stripPriceMentions(f.q), a: stripPriceMentions(f.a) }));
  const n = await nonce();
  const hasH1 = blocks.some((b) => b.type === "hero");
  return (
    <div className="pb-6" data-testid="landing" data-slug={l.slug}>
      <script type="application/ld+json" nonce={n} dangerouslySetInnerHTML={ldJson(breadcrumbLd([{ name: "Accueil", path: "/" }, { name: l.title, path: `/l/${l.slug}` }]))} />
      {faq.length > 0 && <script type="application/ld+json" nonce={n} dangerouslySetInnerHTML={ldJson(faqLd(faq))} />}
      {!hasH1 && <h1 className="shell pt-10 text-d1 sm:pt-16">{l.title}</h1>}
      <Blocks blocks={blocks} products={await allProducts()} showPrices={showPrices} />
    </div>
  );
}
