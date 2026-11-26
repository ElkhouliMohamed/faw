import Link from "next/link";
import { FileText } from "lucide-react";
import { ProductCard } from "@/components/product-card";
import { AvailabilityBadge } from "@/components/availability-badge";
import { getDict } from "@/lib/i18n-server";
import { ancestry, categoryTree, childrenOf, productsUnder, type CatNode } from "@/lib/category-tree";
import { InternalLinks } from "@/components/internal-links";
import { effectiveAvailability, splitVariantLabel, toPublic, type Faq, type Product } from "@/lib/products";
import { breadcrumbLd, faqLd, ldJson } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { formatDH } from "@/lib/format";
import { showPublicPrices } from "@/lib/price-visibility";

function priceFaq(landing: { key: CatNode["family"] }, list: Product[], showPrices: boolean): Faq | null {
  if (!showPrices) {
    return { q: landing.key === "portes-coupe-feu" ? "Quel est le prix d'une porte coupe-feu EI60 ?" : `Quel est le prix d'${landing.key === "galandage" ? "un châssis galandage" : "un extincteur ou du matériel incendie"} ?`, a: "Prix sur devis. L'équipe FAW vous envoie le devis PDF après validation de votre demande. " + (landing.key === "incendie" ? "Installation" : "Pose") + " non comprise." };
  }
  const priced = list.filter((p) => p.price > 0);
  if (!priced.length) return null;
  const min = Math.min(...priced.map((p) => p.price));
  const max = Math.max(...priced.map((p) => p.price));
  if (landing.key === "portes-coupe-feu") {
    const one = priced.filter((p) => !/2 vantaux/.test(p.variantLabel ?? "") && !/-2V/i.test(p.id));
    const two = priced.filter((p) => /2 vantaux/.test(p.variantLabel ?? "") || /-2V/i.test(p.id));
    const parts = [] as string[];
    if (one.length) parts.push(`1 vantail : à partir de ${formatDH(Math.min(...one.map((p) => p.price)))}`);
    if (two.length) parts.push(`2 vantaux : de ${formatDH(Math.min(...two.map((p) => p.price)))} à ${formatDH(Math.max(...two.map((p) => p.price)))}`);
    parts.push("tarif dégressif de 2 000 DH TTC la porte dès 4 portes 1 vantail de 80, 90 ou 100 cm");
    return { q: "Quel est le prix d'une porte coupe-feu EI60 ?", a: `${parts.join(" ; ")}. Pose non comprise.` };
  }
  const label = landing.key === "galandage" ? "un châssis galandage" : "un extincteur ou du matériel incendie";
  return { q: `Quel est le prix d'${label.replace(/^un /, "un ")} ?`, a: `De ${formatDH(min)} à ${formatDH(max)} selon le modèle. ${landing.key === "incendie" ? "Installation" : "Pose"} non comprise.` };
}

/** Page catégorie indexable (arbre Laravel) : H1 unique, introduction, sous-catégories, produits, FAQ réelle, maillage. */
export async function CategoryView({ node }: { node: CatNode }) {
  const { t } = await getDict();
  const showPrices = await showPublicPrices();
  const list = await productsUnder(node);
  const chain = await ancestry(node);
  const subs = await childrenOf(node);
  // FAQ seulement si la catégorie a un contenu réel (page historique) ; jamais de FAQ générée pour une nouvelle catégorie.
  const pf = node.faq.length && node.parentId == null ? priceFaq({ key: node.family }, list, showPrices) : null;
  const faq = pf ? [pf, ...node.faq] : node.faq;
  const landing = { key: node.family, h1: node.h1, intro: node.intro, slug: node.pageSlug };

  const crumbs = breadcrumbLd([
    { name: "Accueil", path: "/" },
    { name: "Boutique", path: "/produits" },
    ...chain.map((c) => ({ name: c.label, path: c.path })),
  ]);
  const siblings = (await categoryTree()).filter((c) => c.parentId == null && c.id !== node.id && !chain.some((a) => a.id === c.id));
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: landing.h1,
    itemListElement: list.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE.url}/produits/${p.slug}`, name: p.title })),
  };
  const sized = list.filter((p) => p.variantLabel);

  return (
    <div className="shell pt-6 sm:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(crumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(itemList)} />
      {faq.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqLd(faq))} />}
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Accueil</Link>
        <span aria-hidden>/</span>
        <Link href="/produits" className="hover:text-foreground">{t.nav.shop}</Link>
        {chain.map((c, i) => (
          <span key={c.id} className="contents">
            <span aria-hidden>/</span>
            {i < chain.length - 1 ? <Link href={c.path} className="hover:text-foreground">{c.label}</Link> : <span className="text-foreground" aria-current="page">{c.label}</span>}
          </span>
        ))}
      </nav>

      <header className="grid-12 mt-6 gap-y-6 pb-10">
        <div className="col-span-12 lg:col-span-8">
          <p className="eyebrow text-copper">FAW · Casablanca</p>
          <h1 className="mt-3 text-d2 text-balance sm:text-d1" lang="fr" dir="ltr" data-testid="category-h1">{landing.h1}</h1>
          <div className="mt-6 max-w-2xl space-y-3 text-muted-foreground" lang="fr" dir="ltr">
            {landing.intro.map((x) => <p key={x.slice(0, 20)}>{x}</p>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/devis?categorie=${encodeURIComponent(node.slug)}`} className="btn btn-primary px-5"><FileText className="size-4" aria-hidden /> {t.v4.quoteCta}</Link>
            <Link href="/livraison" className="btn btn-ghost px-5">{t.nav.delivery}</Link>
          </div>
        </div>
      </header>

      {subs.length > 0 && (
        <section aria-labelledby="sous-categories" className="hairline pt-10" data-testid="subcategories">
          <h2 id="sous-categories" className="text-d3">Sous-catégories</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {subs.map((c) => <li key={c.id}><Link href={c.path} className="btn btn-ghost px-4">{c.label}</Link></li>)}
          </ul>
        </section>
      )}

      {sized.length > 3 && (
        <section aria-labelledby="tailles" className="hairline pt-10">
          <h2 id="tailles" className="text-d3">{showPrices ? "Tailles et prix" : "Tailles"}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm sm:min-w-[30rem]" lang="fr" dir="ltr" data-testid="size-table">
              <thead>
                <tr className="border-b border-rule text-start text-muted-foreground">
                  <th scope="col" className="hidden py-2 pe-3 text-start font-medium sm:table-cell">Modèle</th>
                  <th scope="col" className="py-2 pe-3 text-start font-medium">Taille</th>
                  <th scope="col" className="py-2 pe-3 text-end font-medium">{showPrices ? "Prix TTC" : "Prix"}</th>
                  <th scope="col" className="py-2 text-end font-medium">Disponibilité</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule">
                {sized.map((p) => {
                  const [size, section] = splitVariantLabel(p.variantLabel);
                  return (
                    <tr key={p.id}>
                      <td className="hidden py-2.5 pe-3 sm:table-cell"><Link href={`/produits/${p.slug}`} className="font-medium hover:text-copper">{p.title}</Link></td>
                      {/* mobile : la colonne Modèle est masquée, la taille devient le lien */}
                      <td className="py-2.5 pe-3"><Link href={`/produits/${p.slug}`} className="font-medium hover:text-copper sm:hidden">{size}{section ? ` · ${section}` : ""}</Link><span className="hidden whitespace-nowrap sm:inline">{size}{section ? ` · ${section}` : ""}</span></td>
                      <td className="py-2.5 pe-3 text-end font-semibold tnum whitespace-nowrap text-price">{showPrices && p.price > 0 ? formatDH(p.price) : "Prix sur devis"}</td>
                      <td className="py-2.5 text-end"><AvailabilityBadge value={effectiveAvailability(p)} compact /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{showPrices ? "Prix TTC" : "Prix sur devis"} · {landing.key === "incendie" ? "Installation" : "Pose"} non comprise.</p>
        </section>
      )}

      <section aria-labelledby="produits-cat" className="mt-14">
        <h2 id="produits-cat" className="text-d3">{node.label} — {list.length} {list.length > 1 ? "produits" : "produit"}</h2>
        <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 md:gap-x-6 xl:grid-cols-4 xl:gap-x-8">
          {list.map((p, i) => (
            <li key={p.id}>
              <ProductCard p={toPublic(p, showPrices)} catLabel={node.label} noImage={t.product.noImage} priority={i < 2} />
            </li>
          ))}
        </ul>
      </section>

      {faq.length > 0 && <section aria-labelledby="faq-cat" className="mt-20 grid-12 hairline pt-10" data-testid="category-faq">
        <h2 id="faq-cat" className="col-span-12 text-d3 lg:col-span-4">{t.v4.faq}</h2>
        <div className="col-span-12 divide-y divide-rule lg:col-span-8" lang="fr" dir="ltr">
          {faq.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-medium">
                {f.q}
                <span className="text-lg leading-none font-light text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-2 text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </section>}

      <InternalLinks
        className="mt-16"
        groups={[
          ...(chain.length > 1 ? [{ title: "Catégorie parente", links: chain.slice(0, -1).map((c) => ({ href: c.path, label: c.label })) }] : []),
          ...(subs.length ? [{ title: "Sous-catégories", links: subs.map((c) => ({ href: c.path, label: c.label })) }] : []),
          { title: "Autres catégories", links: siblings.map((c) => ({ href: c.path, label: c.label })) },
          { title: "Produits", links: list.slice(0, 6).map((p) => ({ href: `/produits/${p.slug}`, label: p.title })) },
        ]}
        quoteHref={`/devis?categorie=${encodeURIComponent(node.slug)}`}
        quoteLabel={t.v4.quoteCta}
      />
    </div>
  );
}
