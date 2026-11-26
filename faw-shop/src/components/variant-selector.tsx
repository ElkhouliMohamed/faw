"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductImage } from "./product-image";
import { useT } from "./providers";
import { formatDH } from "@/lib/format";
import type { Availability } from "@/lib/products";
import { cn } from "@/lib/utils";

export type VariantOption = {
  id: string;
  slug: string;
  size: string; // « 90 cm »
  section: string; // « 1 vantail » / « 2 vantaux » / ""
  price?: number;
  image: string | null;
  availability: Availability;
  orderable: boolean;
};

/**
 * Sélecteur de taille : chaque taille est une fiche indexable (URL conservée).
 * Le clic met à jour immédiatement prix + photo d'exemple, puis charge la fiche de la taille.
 */
export function VariantSelector({ current, options }: { current: string; options: VariantOption[] }) {
  const { t } = useT();
  const router = useRouter();
  const [sel, setSel] = useState(current);
  const [pending, start] = useTransition();
  const active = options.find((o) => o.id === sel) ?? options[0];
  const sections = [...new Set(options.map((o) => o.section))];

  return (
    <section className="rounded-lg border border-rule p-4 sm:p-5" aria-labelledby="variant-title" data-testid="variant-selector">
      <div className="flex items-start gap-4">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-md bg-sand sm:size-24">
          <ProductImage src={active.image} alt={`Exemple : ${active.size}${active.section ? ` ${active.section}` : ""}`} reference={active.id} placeholderLabel="" sizes="96px" fit="cover" />
        </div>
        <div className="min-w-0">
          <h2 id="variant-title" className="text-base font-semibold">{t.v4.size}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.v4.sizeHint}</p>
          <p className="mt-2 text-lg font-semibold tnum text-price" dir="ltr" data-testid="variant-price" aria-live="polite">
            {active.size}{active.section ? ` · ${active.section}` : ""} — {active.price != null && active.price > 0 ? formatDH(active.price) : "Prix sur devis"}
          </p>
          <p className="text-[0.6875rem] text-muted-foreground">{t.v4.illustration}</p>
        </div>
      </div>
      <div className={cn("mt-4 space-y-3", pending && "opacity-80")}>
        {sections.map((sec) => (
          <div key={sec || "all"}>
            {sec && <p className="eyebrow mb-2 text-muted-foreground">{sec}</p>}
            <ul className="flex flex-wrap gap-2" role="list">
              {options
                .filter((o) => o.section === sec)
                .map((o) => {
                  const on = o.id === sel;
                  return (
                    <li key={o.id}>
                      <Link
                        href={`/produits/${o.slug}`}
                        scroll={false}
                        prefetch
                        aria-current={on ? "page" : undefined}
                        data-testid={`variant-${o.id}`}
                        onClick={(e) => {
                          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                          e.preventDefault();
                          setSel(o.id);
                          start(() => router.push(`/produits/${o.slug}`, { scroll: false }));
                        }}
                        className={cn(
                          "flex min-h-11 min-w-[5.5rem] flex-col items-center justify-center rounded-lg border px-3 py-1.5 text-center transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary",
                          !o.orderable && !on && "opacity-60",
                        )}
                      >
                        <span className="text-sm font-semibold" dir="ltr">{o.size}</span>
                        <span className={cn("text-[0.6875rem] tnum", on ? "text-primary-foreground" : "text-muted-foreground")} dir="ltr">
                          {o.price != null && o.price > 0 ? formatDH(o.price, false) : o.orderable ? "Sur devis" : o.availability === "bientôt disponible" ? t.v4.soon : t.v4.unavailable}
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
