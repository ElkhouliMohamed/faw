import type { HomeSectionOf } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icon";

/**
 * Bandeau d'atouts : carte blanche arrondie, colonnes séparées par des filets, icône orange + libellé.
 * Placée juste après la bannière, elle la chevauche (marge négative). 2 × 2 sur mobile.
 */
export function FeaturesSection({ s, overlap, index }: { s: HomeSectionOf<"features">; overlap: boolean; index: number }) {
  const n = s.items.length;
  if (!n) return null;
  const id = `home-features-${index}`;
  const lastRowStart = n % 2 === 0 ? n - 2 : n - 1;
  return (
    <section className={cn("shell relative z-10", overlap ? "-mt-10 lg:-mt-14" : "pt-10")} aria-labelledby={s.title ? id : undefined} data-section="features">
      {s.title && <h2 id={id} className="sr-only">{s.title}</h2>}
      <ul
        className="grid grid-cols-2 overflow-hidden rounded-2xl bg-card shadow-[0_18px_44px_-22px_rgb(58_36_22/0.28)] ring-1 ring-rule/60 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]"
        style={{ "--n": n } as React.CSSProperties}
      >
        {s.items.map((item, i) => (
          <li
            key={i}
            className={cn(
              "relative flex flex-col items-center gap-2.5 px-3 py-6 text-center sm:px-5 lg:py-7",
              i % 2 === 0 && i !== n - 1 && "border-e border-rule",
              i < lastRowStart && "border-b border-rule",
              "lg:border-e-0 lg:border-b-0",
              // filet vertical court entre les colonnes (maquette)
              i < n - 1 && "lg:after:absolute lg:after:inset-y-[22%] lg:after:end-0 lg:after:w-px lg:after:bg-rule",
            )}
          >
            <HomeIcon name={item.icon} className="size-11 text-flame" strokeWidth={1.4} fallback="check-circle" />
            <span className="max-w-[12ch] text-[0.9375rem] leading-snug font-bold text-foreground">{item.title}</span>
            {item.text && <span className="-mt-1 max-w-[24ch] text-[0.8125rem] leading-snug text-muted-foreground">{item.text}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
