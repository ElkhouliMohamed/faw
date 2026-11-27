import { Check } from "lucide-react";
import type { HomeSectionOf } from "@/lib/site-content";
import { Eyebrow, PillLink, Photo, SectionTitle } from "./ui";

/** À propos : grande photo arrondie à gauche ; sur-titre, titre, texte, liste à coches orange et bouton « pilule » à droite. */
export function AboutSection({ s, index, photoSoon }: { s: HomeSectionOf<"about">; index: number; photoSoon: string }) {
  const id = `home-about-${index}`;
  return (
    <section id={s.anchor || undefined} className="shell scroll-mt-28 pt-16 lg:pt-24" aria-labelledby={s.title ? id : undefined} data-section="about">
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-sand shadow-soft">
          <Photo src={s.image} alt={s.imageAlt} sizes="(min-width:1024px) 46vw, 92vw" placeholder={photoSoon} />
        </div>
        <div>
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <SectionTitle id={id} className="mt-3">{s.title}</SectionTitle>}
          {s.text && <p className="mt-4 max-w-[52ch] text-[0.9375rem] leading-relaxed whitespace-pre-line text-muted-foreground">{s.text}</p>}
          {s.checklist.length > 0 && (
            <ul className="mt-5 space-y-2.5">
              {s.checklist.map((c, i) => (
                <li key={i} className="flex items-center gap-3 text-[0.9375rem] font-semibold text-foreground">
                  <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-flame text-white">
                    <Check className="size-3" strokeWidth={3.2} />
                  </span>
                  {c.text}
                </li>
              ))}
            </ul>
          )}
          {s.buttonLabel && s.buttonUrl && <PillLink href={s.buttonUrl} className="mt-7">{s.buttonLabel}</PillLink>}
        </div>
      </div>
    </section>
  );
}
