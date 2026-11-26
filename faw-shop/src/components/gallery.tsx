"use client";

import { useRef, useState } from "react";
import { ProductImage } from "./product-image";
import { useT } from "./providers";
import type { GalleryImage } from "@/lib/products";
import { cn } from "@/lib/utils";

/**
 * Galerie produit : carrousel à accroche sur mobile (compteur), pile verticale sur desktop
 * (la colonne d'infos reste collante à côté).
 */
export function Gallery({ images, title, reference }: { images: GalleryImage[]; title: string; reference: string; contain?: boolean }) {
  const { t } = useT();
  const list = images.length ? images : [{ src: "", alt: title } as GalleryImage];
  const [cur, setCur] = useState(0);
  const scroller = useRef<HTMLUListElement>(null);

  return (
    <div className="relative">
      <ul
        ref={scroller}
        aria-label="Images du produit"
        onScroll={(e) => {
          const el = e.currentTarget;
          setCur(Math.round(Math.abs(el.scrollLeft) / el.clientWidth));
        }}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory overflow-x-auto sm:mx-0 lg:flex-col lg:gap-6 lg:overflow-visible"
      >
        {list.map((im, k) => {
          const isContain = !!im.illustration;
          return (
            <li key={im.src || k} className="w-full shrink-0 snap-center px-4 sm:px-0">
              <div className={cn("relative aspect-[4/5] overflow-hidden rounded-lg", "bg-sand")}>
                <ProductImage
                  src={im.src || null}
                  alt={im.alt ?? title}
                  reference={reference}
                  placeholderLabel={t.product.noImage}
                  priority={k === 0}
                  fit={isContain ? "contain" : "cover"}
                  className={isContain && im.src ? "p-[8%] mix-blend-multiply dark:mix-blend-normal" : undefined}
                  sizes="(min-width:1024px) 52vw, 100vw"
                />
                {im.caption && (
                  <p className="absolute start-3 bottom-3 max-w-[calc(100%-1.5rem)] rounded-lg bg-background/90 px-2.5 py-1.5 text-xs leading-snug text-foreground" lang="fr" dir="ltr">
                    {im.caption}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {list.length > 1 && (
        <div className="mt-3 flex items-center justify-between lg:hidden" aria-hidden>
          <div className="flex gap-1.5">
            {list.map((_, k) => (
              <span key={k} className={cn("h-0.5 w-6 transition-colors", k === cur ? "bg-foreground" : "bg-rule")} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground tnum" dir="ltr">
            {String(cur + 1).padStart(2, "0")} / {String(list.length).padStart(2, "0")}
          </span>
        </div>
      )}
    </div>
  );
}
