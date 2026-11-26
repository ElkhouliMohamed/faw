"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { ProductCard } from "./product-card";
import { useShop, useT } from "./providers";
import { CATEGORIES, type PublicProduct } from "@/lib/products";
import { cn } from "@/lib/utils";

type Sort = "default" | "asc" | "desc";

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function Catalog({ products, initialCat, initialQ, initialSort }: { products: PublicProduct[]; initialCat: string; initialQ: string; initialSort: Sort }) {
  const { t } = useT();
  const shop = useShop();
  const showPrices = shop.showPrices;
  // Catégories du back-office (les 4 historiques gardent leur libellé traduit).
  const cats = shop.categories.length ? shop.categories.map((c) => c.slug) : CATEGORIES.map((c) => c.key);
  const labelOf = (slug: string) => (slug in t.cats ? t.cats[slug as keyof typeof t.cats] : shop.categories.find((c) => c.slug === slug)?.label ?? slug);
  const [cat, setCat] = useState<string>(initialCat);
  const [q, setQ] = useState(initialQ);
  const [sort, setSort] = useState<Sort>(initialSort);
  const [onlyAvail, setOnlyAvail] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (cat !== "all") sp.set("categorie", cat);
    if (q.trim()) sp.set("q", q.trim());
    if (sort !== "default") sp.set("tri", sort === "asc" ? "prix-croissant" : "prix-decroissant");
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [cat, q, sort]);

  const list = useMemo(() => {
    const nq = norm(q.trim());
    let l = products.filter((p) => (cat === "all" || (p.catSlug || p.cat) === cat) && (!nq || norm(`${p.title} ${p.id} ${p.description}`).includes(nq)) && (!onlyAvail || p.orderable));
    if (showPrices && sort !== "default") l = [...l].sort((a, b) => (sort === "asc" ? (a.price ?? 0) - (b.price ?? 0) : (b.price ?? 0) - (a.price ?? 0)));
    return l;
  }, [products, cat, q, sort, onlyAvail, showPrices]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: products.length };
    for (const p of products) c[p.catSlug || p.cat] = (c[p.catSlug || p.cat] ?? 0) + 1;
    return c;
  }, [products]);

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-4 flex flex-col gap-3 border-b border-rule bg-background/90 px-4 py-4 backdrop-blur-md sm:-mx-8 sm:px-8 lg:top-[72px] xl:-mx-12 xl:px-12">
        <div role="tablist" aria-label="Catégories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          {["all", ...cats.filter((k) => counts[k])].map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={cat === k}
              data-testid={`filter-${k}`}
              onClick={() => setCat(k)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors",
                cat === k ? "border-primary bg-primary text-primary-foreground" : "border-rule text-muted-foreground hover:border-foreground/40 hover:text-foreground",
              )}
            >
              {k === "all" ? t.shop.all : labelOf(k)}
              <span className={cn("text-xs tnum", cat === k ? "opacity-80" : "text-muted-foreground")}>{counts[k] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="order-2 flex items-center gap-4 sm:order-1">
          <p className="text-sm text-muted-foreground" aria-live="polite" data-testid="result-count">{t.shop.results(list.length)}</p>
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={onlyAvail} onChange={(e) => setOnlyAvail(e.target.checked)} className="size-4 accent-[var(--flame)]" data-testid="filter-available" />
            Commandable en ligne
          </label>
        </div>
        <div className="order-1 flex gap-2 sm:order-2">
          <label className="relative flex-1 sm:w-80 sm:flex-none">
            <span className="sr-only">{t.shop.search}</span>
            <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.shop.search}
              data-testid="search"
              className="h-10 w-full rounded-lg border border-input bg-card ps-9 pe-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label="Effacer">
                <X className="size-4" />
              </button>
            )}
          </label>
          {showPrices && (
          <label className="relative">
            <span className="sr-only">{t.shop.sort}</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              data-testid="sort"
              className="h-10 appearance-none rounded-lg border border-input bg-card ps-3 pe-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            >
              <option value="default">{t.shop.sortDefault}</option>
              <option value="asc">{t.shop.sortAsc}</option>
              <option value="desc">{t.shop.sortDesc}</option>
            </select>
            <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">▾</span>
          </label>
          )}
        </div>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="mt-10 rounded-lg bg-sand p-10 text-center text-muted-foreground">{t.shop.none}</p>
      ) : (
        <ul className="grid-12 mt-10 gap-y-12">
          {list.map((p, i) => (
            <li key={p.id} className="col-span-6 md:col-span-4 xl:col-span-3">
              <ProductCard p={p} catLabel={labelOf(p.catSlug || p.cat)} noImage={t.product.noImage} priority={i < 2} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
