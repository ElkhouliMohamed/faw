import Image from "next/image";
import type { HomeSectionOf } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icon";

/** Lueur « feu » dessinée en CSS : remplace l'image de fond tant que le client n'en a pas téléversé. */
export const EMBER =
  "bg-[radial-gradient(30%_110%_at_100%_85%,rgb(240_138_36/0.7),transparent_70%),radial-gradient(22%_70%_at_94%_25%,rgb(214_70_20/0.45),transparent_75%),radial-gradient(45%_140%_at_100%_50%,rgb(120_40_10/0.5),transparent_75%)]";

/** Image (ou lueur) à droite d'un bandeau brun, fondue vers la gauche. */
export function BandBackground({ image }: { image: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-y-0 end-0 w-full sm:w-2/3 lg:w-1/2">
      {image ? (
        <div className="relative h-full w-full opacity-70 [mask-image:linear-gradient(to_right,transparent,black_60%)] rtl:[mask-image:linear-gradient(to_left,transparent,black_60%)]">
          <Image src={image} alt="" fill sizes="(min-width:1024px) 50vw, 66vw" className="object-cover" />
        </div>
      ) : (
        <div className={cn("h-full w-full rtl:-scale-x-100", EMBER)} />
      )}
    </div>
  );
}

/** Bandeau brun arrondi « Pourquoi choisir… » : titre à gauche, arguments icône + libellé en colonnes séparées. */
export function HighlightsSection({ s, index }: { s: HomeSectionOf<"highlights">; index: number }) {
  const id = `home-highlights-${index}`;
  const n = s.items.length;
  return (
    <section className="shell pt-16 lg:pt-24" aria-labelledby={id} data-section="highlights">
      <div className="relative isolate overflow-hidden rounded-2xl bg-bark px-6 py-8 text-bark-fg shadow-soft sm:px-10 lg:py-10">
        <BandBackground image={s.backgroundImage} />
        <div className="relative grid gap-8 lg:grid-cols-12 lg:items-center">
          <h2 id={id} className="max-w-[20ch] text-[clamp(1.35rem,1.1rem+0.9vw,1.875rem)] leading-tight font-bold lg:col-span-4">{s.title}</h2>
          {n > 0 && (
            <ul className="grid grid-cols-2 gap-y-6 lg:col-span-8 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]" style={{ "--n": n } as React.CSSProperties}>
              {s.items.map((item, i) => (
                <li key={i} className={cn("relative flex flex-col items-center gap-3 px-3 text-center", i % 2 === 0 && i < n - 1 && "border-e border-bark-fg/15 lg:border-e-0", i < n - 1 && "lg:after:absolute lg:after:inset-y-[8%] lg:after:end-0 lg:after:w-px lg:after:bg-bark-fg/15")}>
                  <HomeIcon name={item.icon} className="size-10 text-flame" strokeWidth={1.3} fallback="award" />
                  <span className="max-w-[16ch] text-[0.875rem] leading-snug font-semibold">{item.label}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
