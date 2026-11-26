import Image from "next/image";
import { cn } from "@/lib/utils";

/** Image produit, ou visuel FAW de remplacement quand aucune photo propre n'existe encore. */
export function ProductImage({
  src,
  alt,
  sizes,
  className,
  priority,
  reference,
  placeholderLabel = "Visuel à venir",
  fit = "cover",
}: {
  src: string | null;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  reference?: string;
  placeholderLabel?: string;
  fit?: "cover" | "contain";
}) {
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${alt} – ${placeholderLabel}`}
        className={cn("relative flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden bg-sand text-muted-foreground", className)}
      >
        <svg viewBox="0 0 64 96" className="relative h-2/5 max-h-32 w-auto text-flame" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M26 14h12v8H26z" />
          <path d="M38 17h10l6 6" strokeLinecap="round" />
          <path d="M54 23v10" strokeLinecap="round" />
          <rect x="18" y="22" width="28" height="66" rx="12" />
          <path d="M18 46h28M18 70h28" opacity=".5" />
        </svg>
        <span className="eyebrow relative">{placeholderLabel}</span>
        {reference && <span className="eyebrow relative text-[0.6875rem] opacity-80" dir="ltr">{reference}</span>}
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
    />
  );
}
