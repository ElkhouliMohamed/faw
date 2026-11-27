import { ArrowRight } from "lucide-react";
import type { HomeSectionOf } from "@/lib/site-content";
import { HomeIcon } from "./icon";
import { Eyebrow, SectionTitle } from "./ui";

/**
 * Processus : titre à gauche ; étapes numérotées (pastille orange), icône, libellé, flèches entre les étapes.
 * Mobile : étapes verticales reliées par un filet.
 */
export function ProcessSection({ s, index }: { s: HomeSectionOf<"process">; index: number }) {
  if (!s.steps.length) return null;
  const id = `home-process-${index}`;
  const n = s.steps.length;
  return (
    <section id={s.anchor || undefined} className="shell scroll-mt-28 pt-16 lg:pt-24" aria-labelledby={s.title ? id : undefined} data-section="process">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
        <div className="lg:col-span-3">
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <SectionTitle id={id} className="mt-3 max-w-[16ch] text-[clamp(1.35rem,1.15rem+0.8vw,1.75rem)]">{s.title}</SectionTitle>}
          {s.text && <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted-foreground">{s.text}</p>}
        </div>
        <ol className="relative grid gap-6 lg:col-span-9 lg:gap-0 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ "--n": n } as React.CSSProperties}>
          {s.steps.map((step, i) => (
            <li key={i} className="relative flex items-start gap-4 lg:flex-col lg:items-center lg:gap-3 lg:px-4 lg:text-center">
              {/* filet vertical (mobile) */}
              {i < n - 1 && <span aria-hidden className="absolute start-[0.875rem] top-9 -bottom-6 w-px bg-rule lg:hidden" />}
              {/* filet horizontal reliant les pastilles (desktop) */}
              {i < n - 1 && <span aria-hidden className="absolute start-1/2 top-3.5 hidden h-px w-full bg-rule lg:block" />}
              <span className="relative z-[1] grid size-7 shrink-0 place-items-center rounded-full bg-flame text-[0.8125rem] font-bold text-white shadow-soft" aria-hidden>
                {i + 1}
              </span>
              <div className="flex min-w-0 items-center gap-3 lg:flex-col">
                <HomeIcon name={step.icon} className="size-8 shrink-0 text-copper" strokeWidth={1.4} fallback="check-circle" />
                <div>
                  <h3 className="text-[0.875rem] leading-snug font-semibold text-foreground lg:max-w-[18ch]">
                    <span className="sr-only">{i + 1}. </span>
                    {step.title}
                  </h3>
                  {step.text && <p className="mt-1 text-[0.8125rem] leading-snug text-muted-foreground">{step.text}</p>}
                </div>
              </div>
              {/* flèche vers l'étape suivante (et après la dernière, comme la maquette) */}
              <ArrowRight aria-hidden className="absolute end-0 top-[4.25rem] hidden size-4 translate-x-1/2 text-foreground/40 lg:block rtl:-translate-x-1/2 rtl:rotate-180" />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
