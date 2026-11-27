import type { HomeSectionOf } from "@/lib/site-content";
import { Eyebrow, PillLink, Photo, SectionTitle, SmartLink } from "./ui";

/** Réalisations : en-tête + lien « pilule », photos arrondies en ligne (4 par ligne, 2 sur mobile), nom et lieu au survol. */
export function ProjectsSection({ s, index }: { s: HomeSectionOf<"projects">; index: number }) {
  if (!s.items.length && !s.title) return null;
  const id = `home-projects-${index}`;
  return (
    <section id={s.anchor || undefined} className="shell scroll-mt-28 pt-16 lg:pt-24" aria-labelledby={s.title ? id : undefined} data-section="projects">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div>
          {s.eyebrow && <Eyebrow>{s.eyebrow}</Eyebrow>}
          {s.title && <SectionTitle id={id} className="mt-3">{s.title}</SectionTitle>}
        </div>
        {s.linkLabel && s.linkUrl && <PillLink href={s.linkUrl}>{s.linkLabel}</PillLink>}
      </div>
      {s.items.length > 0 && (
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {s.items.map((p, i) => {
            const caption = [p.title, p.location].filter(Boolean).join(" · ");
            const body = (
              <>
                <Photo src={p.image} alt={caption} sizes="(min-width:1024px) 23vw, 46vw" className="transition-transform duration-500 group-hover:scale-[1.04]" placeholderClassName="justify-start pt-[14%] [&>svg]:size-8 sm:pt-[18%]" />
                <span
                  className={
                    p.image
                      ? "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-8 pb-3 text-start text-[0.8125rem] font-semibold text-white opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-visible:opacity-100"
                      : "absolute inset-x-0 bottom-0 px-3 pb-3 text-start text-[0.8125rem] font-semibold text-foreground"
                  }
                  aria-hidden
                >
                  {p.title}
                  {p.location && <span className="block text-[0.75rem] font-normal opacity-80">{p.location}</span>}
                </span>
              </>
            );
            const cls = "group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-sand shadow-soft";
            return (
              <li key={i}>
                {p.url ? <SmartLink href={p.url} className={cls}>{body}</SmartLink> : <div className={cls}>{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
