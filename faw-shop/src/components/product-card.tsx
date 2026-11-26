import Link from "next/link";
import { ProductImage } from "./product-image";
import { QuickAdd } from "./quick-add";
import { AvailabilityBadge } from "./availability-badge";
import { NoBreak } from "./nobreak";
import { itemHref, type PublicProduct } from "@/lib/products";
import { Badges, Price } from "./price";
import { cn } from "@/lib/utils";

/** Carte produit épurée : image, catégorie, titre, prix « X DH TTC » et ajout rapide. */
export function ProductCard({
  p,
  catLabel,
  noImage,
  className,
  priority,
  sizes = "(min-width:1280px) 22vw, (min-width:768px) 30vw, 46vw",
}: {
  p: PublicProduct;
  catLabel: string;
  noImage: string;
  className?: string;
  priority?: boolean;
  viewLabel?: string;
  aspect?: string;
  sizes?: string;
  index?: number;
}) {
  const href = itemHref(p);
  return (
    <article data-testid="product-card" className={cn("group relative flex h-full min-w-0 flex-col", className)}>
      <Link href={href} tabIndex={-1} aria-hidden className="relative block aspect-[4/5] overflow-hidden rounded-lg bg-sand ring-1 ring-rule/60 ring-inset">
        <ProductImage
          src={p.image}
          alt=""
          reference={p.id}
          placeholderLabel={noImage}
          priority={priority}
          fit="cover"
          sizes={sizes}
          className="transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        <Badges badges={p.badges} className="absolute top-2.5 left-2.5 max-w-[85%]" />
      </Link>
      <div className="flex flex-1 flex-col pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="eyebrow truncate text-muted-foreground">{catLabel}</p>
          {p.availability !== "en stock" && <AvailabilityBadge value={p.availability} compact />}
        </div>
        <h3 className="mt-2 line-clamp-2 min-h-[2.75em] text-[0.9375rem] leading-snug font-medium" lang="fr" dir="auto">
          <Link href={href} className="hover:text-copper"><NoBreak text={p.title} /></Link>
        </h3>
        {p.height ? (
          <p className="mt-2 text-[1.0625rem] font-semibold leading-snug tnum text-foreground" data-testid="product-height">
            Hauteur : {p.height}
          </p>
        ) : null}
        <div className="mt-auto flex min-w-0 flex-col gap-3 pt-4">
          <p className="min-w-0 text-base font-semibold tnum text-price">
            <Price price={p.price} compareAt={p.compareAt} onQuote={p.price == null} />
          </p>
          <QuickAdd id={p.id} title={p.title} disabled={!p.orderable} />
        </div>
      </div>
    </article>
  );
}
