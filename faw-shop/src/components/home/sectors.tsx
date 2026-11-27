import type { HomeSectionOf } from "@/lib/site-content";
import { HomeIcon } from "./icon";
import { Eyebrow, SectionTitle, SmartLink } from "./ui";

/** Solutions par secteur : texte à gauche, petites cartes icône + libellé à droite (2 colonnes sur mobile). */
export function SectorsSection({ s, index }: { s: HomeSectionOf<"sectors">; index: number }) {
  if (!s.items.length && !s.title) return null;
  const id = `home-sectors-${index}`;
  const card = "flex h-full min-h-36 flex-col items-center justify-center gap-3 rounded-2xl bg-card px-2.5 py-6 text-center shadow-soft ring-1 ring-rule/70";
  return (
    <section id={s.anchor || undefined} className="shell scroll-mt-28 pt-16 lg:pt-24" aria-labelledby={s.title ? id : undefined} data-section="sectors">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center lg:gap-10">
        <div className="lg:col-span-4">
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <SectionTitle id={id} className="mt-3 max-w-[18ch]">{s.title}</SectionTitle>}
          {s.text && <p className="mt-4 max-w-[46ch] text-[0.9375rem] leading-relaxed text-muted-foreground">{s.text}</p>}
        </div>
        {s.items.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8 lg:[grid-template-columns:repeat(min(var(--n),5),minmax(0,1fr))]" style={{ "--n": s.items.length } as React.CSSProperties}>
            {s.items.map((item, i) => {
              const content = (
                <>
                  <HomeIcon name={item.icon} className="size-10 text-umber dark:text-copper" strokeWidth={1.3} fallback="building-2" />
                  <span className="max-w-[13ch] text-[0.8125rem] leading-snug font-bold text-foreground">{item.label}</span>
                </>
              );
              return (
                <li key={i}>
                  {item.url ? (
                    <SmartLink href={item.url} className={`${card} transition-shadow hover:ring-flame/50`}>{content}</SmartLink>
                  ) : (
                    <div className={card}>{content}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
