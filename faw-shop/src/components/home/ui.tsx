import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Briques communes des sections de l'accueil (maquette client) : liens, sur-titres, titres, boutons « pilule », visuels de remplacement.

export const isExternal = (url: string) => /^(https:|tel:|mailto:)/.test(url);

export function SmartLink({ href, className, children, label, testid }: { href: string; className?: string; children: React.ReactNode; label?: string; testid?: string }) {
  if (isExternal(href))
    return (
      <a href={href} className={className} aria-label={label} data-testid={testid} {...(href.startsWith("https:") ? { target: "_blank", rel: "noopener" } : {})}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={className} aria-label={label} data-testid={testid}>
      {children}
    </Link>
  );
}

/** Sur-titre orange en capitales ; `line` : petit trait après le texte (bannière). */
export function Eyebrow({ children, line = false, className }: { children: React.ReactNode; line?: boolean; className?: string }) {
  return (
    <p className={cn("eyebrow flex items-center gap-3 text-[0.8125rem] font-bold text-copper", className)}>
      {children}
      {line && <span aria-hidden className="inline-block h-0.5 w-10 rounded bg-flame" />}
    </p>
  );
}

export function SectionTitle({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("text-[clamp(1.5rem,1.2rem+1.3vw,2.25rem)] leading-[1.15] font-bold tracking-[-0.02em] text-ink dark:text-foreground", className)}>
      {children}
    </h2>
  );
}

/** Lien « pilule » à contour orange avec flèche (Voir toute la gamme →). */
export function PillLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <SmartLink
      href={href}
      className={cn(
        "group inline-flex min-h-11 items-center gap-2 rounded-full border border-transparent bg-[color-mix(in_oklab,var(--flame)_13%,var(--card))] px-5 text-sm font-semibold text-foreground transition-colors hover:border-flame/50 hover:text-copper",
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4 text-flame transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
    </SmartLink>
  );
}

/** Photo de la section, ou visuel neutre (dégradé chaud + pictogramme) tant que le client n'a pas téléversé de photo. */
export function Photo({
  src,
  alt,
  sizes,
  className,
  fit = "cover",
  priority = false,
  placeholder,
  placeholderClassName,
  icon: Icon = Building2,
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
  fit?: "cover" | "contain";
  priority?: boolean;
  placeholder?: string;
  /** Classes ajoutées au visuel de remplacement (ex. place pour une légende). */
  placeholderClassName?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number; "aria-hidden"?: boolean }>;
}) {
  if (src)
    return (
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        {...(priority ? { fetchPriority: "high" as const } : {})}
        className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
      />
    );
  return (
    <span
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      className={cn(
        "absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(120%_90%_at_80%_0%,color-mix(in_oklab,var(--flame)_22%,transparent),transparent_60%),linear-gradient(160deg,var(--sand),color-mix(in_oklab,var(--sand)_70%,var(--umber)_12%))] text-flame",
        placeholderClassName,
      )}
    >
      <Icon className="size-10 opacity-70" strokeWidth={1.3} aria-hidden />
      {placeholder && <span className="eyebrow text-[0.6875rem] text-muted-foreground">{placeholder}</span>}
    </span>
  );
}
