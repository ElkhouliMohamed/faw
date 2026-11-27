import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound, permanentRedirect } from "next/navigation";
import { Banknote, Download, FileText, PackageCheck, ShieldCheck, Store, Truck } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import { waLink } from "@/lib/site";
import { Gallery } from "@/components/gallery";
import { AddToCart } from "@/components/add-to-cart";
import { AvailabilityBadge } from "@/components/availability-badge";
import { Badges } from "@/components/price";
import { attributeSpecs, cityFeesLine, merch, warrantyFor } from "@/lib/merch";
import { ProductCard } from "@/components/product-card";
import { VariantSelector, type VariantOption } from "@/components/variant-selector";
import { ViewContent } from "@/components/tracking";
import { CategoryView } from "./category-view";
import { getDict } from "@/lib/i18n-server";
import {
  canOrder,
  categoryKey,
  deliveryInfo,
  detailParagraphs,
  installChecks,
  installSteps,
  doorOptions,
  effectiveAvailability,
  gallery,
  productFaq,
  seoDescription,
  seoPageTitle,
  specLine,
  specs,
  type Spec,
  splitVariantLabel,
  toPublic,
  publicBadges,
} from "@/lib/products";
import { allProducts, getProduct, variantSiblings } from "@/lib/catalog";
import { ancestry, categoryByPageSlug, categoryBySlug, categoryForProduct, categoryTree, familyHref } from "@/lib/category-tree";
import { InternalLinks } from "@/components/internal-links";
import { applications } from "@/lib/applications";
import { alternates, breadcrumbLd, faqLd, ldJson } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { DOOR_MAINTENANCE, docInfo, formatBytes, type DocInfo } from "@/lib/docs";
import { formatDH, stripPriceMentions } from "@/lib/format";
import { showPublicPrices } from "@/lib/price-visibility";

function mergeSpecs(base: Spec[], extra: Spec[]): Spec[] {
  const out = [...base];
  for (const s of extra) {
    const i = out.findIndex((x) => x.label === s.label);
    if (i >= 0) out[i] = s;
    else out.push(s);
  }
  return out;
}

/** Place « Hauteur » juste après « Dimensions », pour qu'elle soit lisible dans la fiche. */
function placeSpecHeight(sp: Spec[]): Spec[] {
  const height = sp.find((s) => s.label === "Hauteur");
  if (!height) return sp;
  const rest = sp.filter((s) => s.label !== "Hauteur");
  const dim = rest.findIndex((s) => s.label === "Dimensions");
  rest.splice(dim >= 0 ? dim + 1 : Math.min(3, rest.length), 0, height);
  return rest;
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const node = await categoryByPageSlug(slug);
  if (node) {
    const alt = await alternates(node.path);
    return {
      title: { absolute: node.title },
      description: node.description,
      alternates: alt,
      openGraph: { title: node.title, description: node.description, url: alt.canonical, locale: "fr_MA", type: "website", images: [node.image ?? "/og.jpg"] },
    };
  }
  const p = await getProduct(slug);
  if (!p) return {};
  const show = await showPublicPrices();
  const title = p.metaTitle?.trim() || seoPageTitle(p);
  const desc = p.metaDescription?.trim() || seoDescription(p, show && p.price > 0 ? formatDH(p.price) : "");
  const alt = await alternates(`/produits/${p.slug}`);
  return {
    title: { absolute: title },
    description: show ? desc : stripPriceMentions(desc),
    alternates: alt,
    openGraph: { title, description: show ? desc : stripPriceMentions(desc), images: [p.image ?? "/og.jpg"], type: "website", url: alt.canonical, locale: "fr_MA" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const node = await categoryByPageSlug(slug);
  if (node) return <CategoryView node={node} />;
  const p = await getProduct(slug);
  if (!p) {
    const bySlug = await categoryBySlug(slug.toLowerCase());
    if (bySlug && bySlug.pageSlug !== slug) permanentRedirect(bySlug.path);
    notFound();
  }
  const show = await showPublicPrices();
  const { t, locale } = await getDict();
  const cat = categoryKey(p);
  const imgs = gallery(p);
  const m = await merch();
  const attrSpecs = attributeSpecs(m, p);
  const sp = placeSpecHeight(mergeSpecs(specs(p), attrSpecs));
  const warranty = warrantyFor(m, p);
  const del0 = deliveryInfo(cat);
  const fees = cityFeesLine(m, show);
  const del = { ...del0, lines: del0.lines.map((l) => (show && /^Casablanca : \d+ DH/.test(l) && fees ? fees : l)) };
  const opts = doorOptions(p, show);
  const avail = effectiveAvailability(p);
  const orderable = canOrder(p);
  const priceLabel = show && p.price > 0 ? formatDH(p.price) : "Prix sur devis";
  const faq = productFaq(p, show ? priceLabel : "");
  const siblings = await variantSiblings(p);
  const variantOptions: VariantOption[] = siblings.map((s) => {
    const [size, section] = splitVariantLabel(s.variantLabel);
    const opt: VariantOption = { id: s.id, slug: s.slug, size, section, image: s.image, availability: effectiveAvailability(s), orderable: canOrder(s) };
    if (show) opt.price = s.price;
    return opt;
  });
  const siblingIds = new Set(siblings.map((s) => s.id));
  const related = (await allProducts()).filter((x) => x.category === p.category && x.id !== p.id && !siblingIds.has(x.id)).slice(0, 6).map((x) => toPublic(x, show));
  const relatedList = related.length ? related : (await allProducts()).filter((x) => x.category === p.category && x.id !== p.id).slice(0, 6).map((x) => toPublic(x, show));
  const url = `${SITE.url}/produits/${p.slug}`;
  const contain = cat === "incendie" || cat === "automatisme";
  const install = cat === "incendie" ? "Installation non comprise" : "Pose non comprise";
  const catNode = await categoryForProduct(p);
  const chain = catNode ? await ancestry(catNode) : [];
  const catPath = catNode?.path ?? (await familyHref(cat));
  const catLabel = catNode?.label ?? t.cats[cat];
  const otherCats = (await categoryTree()).filter((c) => c.parentId == null && !chain.some((a) => a.id === c.id));
  const apps = applications(p);
  const h1 = p.h1?.trim() || p.title;
  const details = detailParagraphs(p);
  const steps = installSteps(p);
  const checks = installChecks(p);
  const [sheet, guide] = await Promise.all([docInfo(p.datasheet), docInfo(p.maintenanceGuide)]);
  const maintenance = guide && cat === "portes-coupe-feu" ? DOOR_MAINTENANCE : null;
  const showSheet = !!sheet && !(sheet.href && /catalogue/i.test(sheet.href) && !show);
  const docs = [...(showSheet && sheet ? [{ doc: sheet, title: sheet.title ?? `Fiche technique – ${p.id} (PDF)`, testid: "datasheet-pdf" }] : []), ...(guide ? [{ doc: guide, title: guide.title ?? "Guide de pose & entretien (PDF)", testid: "guide-pdf" }] : [])];
  const toc = [
    { id: "details", label: "Détails" },
    ...(apps.length ? [{ id: "applications", label: "Applications" }] : []),
    { id: "fiche-technique", label: "Fiche technique" },
    ...(docs.length ? [{ id: "documents", label: "Documents" }] : []),
    { id: "installation", label: "Pose" },
    ...(maintenance ? [{ id: "entretien", label: "Entretien" }] : []),
    ...(opts ? [{ id: "options", label: "Options" }] : []),
    { id: "faq", label: "Questions" },
  ];
  const waMsg = `Bonjour FAW, je souhaite des informations sur : ${p.title} (réf. ${p.id}).\n${url}`;

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title,
    sku: p.id,
    description: detailParagraphs(p).join(" "),
    additionalProperty: sp.filter((x) => x.label !== "Disponibilité" && x.label !== "Référence").map((x) => ({ "@type": "PropertyValue", name: x.label, value: x.value })),
    category: p.category,
    image: imgs.filter((i) => !i.illustration).map((i) => `${SITE.url}${i.src}`).concat(p.image ? [] : [`${SITE.url}/og.jpg`]),
    brand: { "@type": "Brand", name: p.brand },
    url,
    ...(show && p.price != null && p.price > 0
      ? {
          offers: {
            "@type": "Offer",
            priceCurrency: "MAD",
            price: p.price,
            itemCondition: "https://schema.org/NewCondition",
            availability: orderable ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
            seller: {
              "@type": "Organization",
              name: SITE.name,
            },
            url,
          },
        }
      : {}),
    ...(guide
      ? {
          subjectOf: [
            { "@type": "DigitalDocument", name: "Guide technique : pose & entretien des portes battantes coupe-feu (FAW)", url: `${SITE.url}${guide.href}`, encodingFormat: "application/pdf", inLanguage: "fr" },
          ],
        }
      : {}),
  };
  const crumbs = breadcrumbLd([
    { name: "Accueil", path: "/" },
    { name: "Boutique", path: "/produits" },
    ...(chain.length ? chain.map((c) => ({ name: c.label, path: c.path })) : [{ name: catLabel, path: catPath }]),
    { name: p.title, path: `/produits/${p.slug}` },
  ]);

  return (
    <div className="shell pt-6 sm:pt-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(productLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(crumbs)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={ldJson(faqLd(faq))} />
      <ViewContent id={p.id} name={p.title} price={show ? p.price : undefined} />
      <nav aria-label="Fil d'Ariane" className="text-sm text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <li><Link href="/" className="hover:text-foreground">Accueil</Link></li>
          <li aria-hidden>/</li>
          <li><Link href="/produits" className="hover:text-foreground">Boutique</Link></li>
          <li aria-hidden>/</li>
          {(chain.length ? chain : [{ id: 0, path: catPath, label: catLabel }]).map((c) => (
            <li key={c.id} className="contents"><Link href={c.path} className="hover:text-foreground">{c.label}</Link><span aria-hidden>/</span></li>
          ))}
          <li aria-current="page" className="max-w-[40ch] truncate text-foreground" lang="fr">{p.variantLabel ?? p.id}</li>
        </ol>
      </nav>

      <div className="grid-12 mt-6 gap-y-10">
        <div className="col-span-12 lg:col-span-7">
          <Gallery images={imgs} title={p.title} reference={p.id} contain={contain} />
          {imgs.length === 0 && <p className="mt-3 text-xs text-muted-foreground" lang="fr">Photo à venir · illustration non contractuelle</p>}
        </div>

        <div className="col-span-12 lg:col-span-5">
          <div className="lg:sticky lg:top-24">
            <div className="flex items-center justify-between gap-4 border-b border-rule pb-4">
              <p className="eyebrow text-copper" dir="ltr">Réf. {p.id}</p>
              <p className="eyebrow text-muted-foreground">{p.brand === "Genius" ? "Genius, fabriqué en Italie" : p.brand}</p>
            </div>
            <h1 className="mt-6 text-d3 text-balance lg:text-[2rem] lg:leading-[1.15]" lang="fr" dir="ltr" data-testid="product-h1">{h1}</h1>
            <p className="mt-3 text-sm text-muted-foreground" lang="fr" dir="ltr" data-testid="spec-line">{specLine(p)}</p>
            {p.shortDescription?.trim() && <p className="mt-3 text-muted-foreground" lang="fr" dir="ltr" data-testid="short-description">{p.shortDescription.trim()}</p>}
            <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="text-d2 font-semibold tnum text-price" dir="ltr" data-testid="price">{priceLabel}</p>
              {show && p.compareAt != null && p.compareAt > p.price && (
                <p className="mb-1.5 text-base text-muted-foreground tnum" dir="ltr">
                  <span className="sr-only">{t.mod.was} : </span>
                  <s data-testid="price-was">{formatDH(p.compareAt)}</s>
                </p>
              )}
              <AvailabilityBadge value={avail} className="mb-1.5" />
            </div>
            {publicBadges(p.badgeList, show).length > 0 && <Badges badges={publicBadges(p.badgeList, show)} className="mt-3" />}
            <p className="mt-2 text-sm text-muted-foreground" lang="fr" data-testid="install-note">{show ? t.product.ttc : t.product.ttcQuote} · {install}</p>

            {variantOptions.length > 1 && (
              <div className="mt-6">
                <VariantSelector current={p.id} options={variantOptions} />
              </div>
            )}

            <div className="mt-6">
              <AddToCart id={p.id} title={p.title} price={show ? p.price : undefined} url={url} orderable={orderable} />
            </div>

            <ul className="mt-6 grid grid-cols-3 gap-2 text-xs text-muted-foreground" lang="fr" data-testid="trust-row">
              <li className="flex flex-col gap-1.5 rounded-lg bg-sand p-3"><FileText className="size-4 text-copper" aria-hidden />Devis PDF validé par l&apos;équipe</li>
              <li className="flex flex-col gap-1.5 rounded-lg bg-sand p-3"><Banknote className="size-4 text-copper" aria-hidden />Virement ou chèque</li>
              <li className="flex flex-col gap-1.5 rounded-lg bg-sand p-3"><Store className="size-4 text-copper" aria-hidden />Bureau à Casablanca</li>
            </ul>

            <section className="mt-6 rounded-lg border border-rule p-5" aria-labelledby="livraison-produit" data-testid="delivery-block">
              <h2 id="livraison-produit" className="flex items-center gap-2 text-base font-semibold">
                <Truck className="size-4 text-copper" aria-hidden /> {locale === "ar" ? t.cart.delivery : del.title}
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground" lang="fr" dir="ltr">
                {del.lines.map((l) => (
                  <li key={l} className="flex gap-2"><span className="mt-2 size-1 shrink-0 rounded-full bg-flame" aria-hidden />{l}</li>
                ))}
              </ul>
              <Link href="/livraison" className="mt-4 inline-block text-sm font-semibold text-copper underline-offset-4 hover:underline">{t.nav.delivery} →</Link>
            </section>
          </div>
        </div>
      </div>

      {/* sommaire de la fiche : ancres collantes */}
      <nav aria-label="Sommaire de la fiche" className="sticky top-16 z-20 -mx-4 mt-16 border-y border-rule bg-background/90 px-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-[72px] lg:mt-24 xl:-mx-12 xl:px-12">
        <ul className="no-scrollbar flex gap-6 overflow-x-auto text-sm font-medium" lang="fr">
          {toc.map((x) => (
            <li key={x.id}><a href={`#${x.id}`} className="block py-4 whitespace-nowrap text-muted-foreground hover:text-foreground">{x.label}</a></li>
          ))}
        </ul>
      </nav>

      <div className="divide-y divide-rule" lang="fr" dir="ltr">
        <section id="details" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="h-details" data-testid="seo-paragraph">
          <h2 id="h-details" className="col-span-12 text-d3 lg:col-span-4">Détails du produit</h2>
          <div className="col-span-12 max-w-[68ch] space-y-4 text-lead text-muted-foreground lg:col-span-8">
            {details.map((d) => <p key={d}>{d}</p>)}
          </div>
        </section>

        {apps.length > 0 && (
          <section id="applications" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="h-apps" data-testid="applications">
            <h2 id="h-apps" className="col-span-12 text-d3 lg:col-span-4">Applications</h2>
            <ul className="col-span-12 space-y-2.5 text-muted-foreground lg:col-span-8">
              {apps.map((a) => <li key={a} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-flame" aria-hidden />{a}</li>)}
            </ul>
          </section>
        )}

        <section id="fiche-technique" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="h-specs" data-testid="datasheet">
          <span id="caracteristiques" className="sr-only scroll-mt-36" aria-hidden />
          <h2 id="h-specs" className="col-span-12 text-d3 lg:col-span-4">Fiche technique</h2>
          <div className="col-span-12 lg:col-span-8">
            <table className="w-full border-y border-rule text-sm" data-testid="spec-table">
              <caption className="sr-only">{t.product.specs} – {p.title}</caption>
              <tbody className="divide-y divide-rule">
                {sp.map((x) => (
                  <tr key={x.label}>
                    <th scope="row" className="w-[38%] py-3 pe-3 text-start align-top font-normal text-muted-foreground">{x.label}</th>
                    <td className="py-3 text-foreground">{x.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {warranty && (
              <div className="mt-6 rounded-lg bg-sand p-5" data-testid="warranty">
                <h3 className="flex items-center gap-2 text-base font-semibold"><ShieldCheck className="size-4 text-copper" aria-hidden /> {t.mod.warranty}</h3>
                <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{warranty.text}</p>
              </div>
            )}
          </div>
        </section>

        {docs.length > 0 && (
          <section id="documents" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="h-docs" data-testid="documents">
            <h2 id="h-docs" className="col-span-12 text-d3 lg:col-span-4">Documents</h2>
            <div className="col-span-12 space-y-4 lg:col-span-8">
              {docs.map((d) => <DocCard key={d.testid} doc={d.doc} title={d.title} testid={d.testid} />)}
              {guide && <p className="text-xs text-muted-foreground">Guide de synthèse FAW : il ne constitue pas un certificat et ne remplace pas la notice applicable au modèle installé.</p>}
            </div>
          </section>
        )}

        <section id="installation" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="h-install" data-testid="install-guide">
          <h2 id="h-install" className="col-span-12 text-d3 lg:col-span-4">{guide ? <>Guide de pose &amp; entretien</> : <>Guide d&apos;installation</>}</h2>
          <div className="col-span-12 space-y-8 lg:col-span-8">
            {steps.length > 0 && (
              <div>
                <h3 className="text-base font-semibold">Pose : étapes</h3>
                <ol className="mt-4 space-y-3">
                  {steps.map((x, i) => (
                    <li key={x} className="flex gap-4 text-muted-foreground"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tnum">{i + 1}</span><span className="pt-0.5">{x}</span></li>
                  ))}
                </ol>
              </div>
            )}
            <div>
              <h3 className="text-base font-semibold">À vérifier avant la pose</h3>
              <ul className="mt-4 space-y-2.5 text-muted-foreground">
                {checks.map((x) => (
                  <li key={x} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-flame" aria-hidden />{x}</li>
                ))}
              </ul>
            </div>
            {steps.length === 0 && (
              <p className="text-sm text-muted-foreground">Le guide de pose détaillé de ce produit n&apos;est pas encore en ligne. Une question ? <a href={waLink(waMsg)} target="_blank" rel="noopener" className="font-semibold text-copper underline-offset-4 hover:underline">Écrivez-nous sur WhatsApp</a>.</p>
            )}
            {maintenance && (
              <div id="entretien" className="scroll-mt-36" data-testid="maintenance">
                <h3 className="text-base font-semibold">Entretien</h3>
                <dl className="mt-4 grid grid-cols-2 gap-3">
                  {maintenance.frequency.map((f) => (
                    <div key={f.value} className="rounded-lg border border-rule p-4">
                      <dt className="text-d3 font-semibold text-copper">{f.value}</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{f.label}</dd>
                    </div>
                  ))}
                </dl>
                <ul className="mt-5 space-y-2.5 text-muted-foreground">
                  {maintenance.checklist.map((x) => (
                    <li key={x} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-flame" aria-hidden />{x}</li>
                  ))}
                </ul>
                <p className="mt-4 text-sm text-muted-foreground">{maintenance.note}</p>
              </div>
            )}
          </div>
        </section>

        {opts && (
          <section id="options" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="h-opts">
            <h2 id="h-opts" className="col-span-12 flex items-center gap-2 text-d3 lg:col-span-4"><PackageCheck className="size-5 text-copper" aria-hidden /> {t.product.options}</h2>
            <ul className="col-span-12 space-y-2.5 text-muted-foreground lg:col-span-8">
              {opts.map((o) => (
                <li key={o} className="flex gap-3"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-flame" aria-hidden />{o}</li>
              ))}
            </ul>
          </section>
        )}

        <section id="faq" className="grid-12 scroll-mt-36 gap-y-4 py-12 lg:py-16" aria-labelledby="faq-produit" data-testid="product-faq">
          <h2 id="faq-produit" className="col-span-12 text-d3 lg:col-span-4">{t.v4.faq}</h2>
          <div className="col-span-12 divide-y divide-rule border-y border-rule lg:col-span-8">
            {faq.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 font-medium">
                  <h3 className="text-base font-medium">{f.q}</h3>
                  <span className="text-lg leading-none font-light text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      {/* bandeau d'action (call-to-buy) */}
      <section className="mt-8 overflow-hidden rounded-lg bg-brand-deep text-brand-deep-fg" aria-labelledby="cta-produit">
        <div className="grid-12 items-center gap-y-6 p-8 sm:p-12">
          <div className="col-span-12 lg:col-span-7">
            <p className="eyebrow text-flame">Devis · quantité · autre taille</p>
            <h2 id="cta-produit" className="mt-3 text-d2">Un projet avec plusieurs {cat === "incendie" ? "équipements" : "produits"} ?</h2>
            <p className="mt-3 max-w-[52ch] opacity-80">Recevez un devis PDF HT et TTC, validé par l&apos;équipe FAW. Paiement par virement ou chèque.</p>
          </div>
          <div className="col-span-12 flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Link href={`/devis?ref=${encodeURIComponent(p.id)}`} className="btn btn-primary" data-testid="cta-quote"><FileText className="size-4" aria-hidden /> {t.v4.quoteCta}</Link>
            <a href={waLink(waMsg)} target="_blank" rel="noopener" className="btn border border-brand-deep-fg/30 hover:border-brand-deep-fg"><WhatsAppIcon className="size-4" /> WhatsApp</a>
          </div>
        </div>
      </section>

      {relatedList.length > 0 && (
        <section className="mt-24 lg:mt-32" aria-labelledby="related">
          <div className="hairline flex items-end justify-between gap-4 pt-10">
            <h2 id="related" className="text-d2">{t.product.related}</h2>
            <Link href={catPath} className="eyebrow hidden text-muted-foreground hover:text-copper sm:block">{catLabel} →</Link>
          </div>
          <ul className="no-scrollbar -mx-4 mt-10 flex snap-x gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8 md:gap-6 xl:-mx-12 xl:scroll-px-12 xl:px-12 xl:gap-8">
            {relatedList.map((r) => (
              <li key={r.id} className="w-[62vw] shrink-0 snap-start sm:w-[38vw] lg:w-[calc(25%-1.125rem)] xl:w-[calc(25%-1.5rem)]">
                <ProductCard p={r} catLabel={t.cats[r.cat]} noImage={t.product.noImage} sizes="(min-width:1024px) 300px, 62vw" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <InternalLinks
        className="mt-20"
        groups={[
          { title: "Catégorie", links: (chain.length ? chain : [{ path: catPath, label: catLabel }]).map((c) => ({ href: c.path, label: c.label })) },
          { title: "Produits de la même catégorie", links: relatedList.slice(0, 5).map((r) => ({ href: `/produits/${r.slug}`, label: r.title })) },
          { title: "Autres catégories", links: otherCats.map((c) => ({ href: c.path, label: c.label })) },
        ]}
        quoteHref={`/devis?ref=${encodeURIComponent(p.id)}`}
        quoteLabel={t.v4.quoteCta}
      />
    </div>
  );
}

function DocCard({ doc, title, testid, className }: { doc: DocInfo; title: string; testid: string; className?: string }) {
  return (
    <a href={doc.href} target="_blank" rel="noopener" download className={`group flex items-center gap-4 rounded-lg border border-rule p-3 pe-5 hover:border-copper ${className ?? ""}`} data-testid={testid}>
      {doc.preview ? (
        <span className={`relative block shrink-0 overflow-hidden rounded border border-rule bg-white ${doc.landscape ? "h-[60px] w-[84px]" : "h-[84px] w-[60px]"}`}>
          <Image src={doc.preview} alt="" fill sizes="60px" className="object-cover object-top" />
        </span>
      ) : (
        <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-copper"><FileText className="size-5" aria-hidden /></span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">PDF{doc.bytes ? ` · ${formatBytes(doc.bytes)}` : ""} · téléchargement optionnel</span>
      </span>
      <Download className="size-5 shrink-0 text-muted-foreground group-hover:text-copper" aria-hidden />
    </a>
  );
}
