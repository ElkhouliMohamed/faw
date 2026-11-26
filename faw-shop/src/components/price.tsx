import { formatDH } from "@/lib/format";
import type { PublicBadge } from "@/lib/products";
import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  neutral: "bg-background/90 text-foreground border border-rule",
  copper: "bg-copper text-white",
  success: "bg-[#3d6b3a] text-white",
  warning: "bg-[#8a5a12] text-white",
  dark: "bg-foreground text-background",
};

/** Prix actif ; en promotion, l'ancien prix est barré (jamais présenté comme une « remise »). */
export function Price({ price, compareAt, className, wasLabel = "Ancien prix", onQuote = false }: { price?: number | null; compareAt?: number | null; className?: string; wasLabel?: string; onQuote?: boolean }) {
  if (onQuote || price == null || price <= 0) {
    return (
      <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)} data-testid="price-box">
        <span data-testid="price-active">Prix sur devis</span>
      </span>
    );
  }
  const promo = compareAt != null && compareAt > price;
  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2", className)} dir="ltr" data-testid="price-box">
      <span className="sr-only">Prix : </span>
      <span data-testid="price-active">{formatDH(price)}</span>
      {promo && (
        <s className="text-[0.8em] font-normal text-muted-foreground" data-testid="price-was">
          <span className="sr-only">{wasLabel} : </span>
          {formatDH(compareAt)}
        </s>
      )}
    </span>
  );
}

export function Badges({ badges, className }: { badges: PublicBadge[]; className?: string }) {
  if (!badges.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)} data-testid="badges">
      {badges.map((b) => (
        <span key={b.label} className={cn("rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase", TONES[b.tone] ?? TONES.neutral)} data-testid="badge">
          {b.label}
        </span>
      ))}
    </span>
  );
}
