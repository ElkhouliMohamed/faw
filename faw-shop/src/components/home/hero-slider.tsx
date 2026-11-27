"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, FileText, Pause, Play } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons";
import type { HeroSlide } from "@/lib/site-content";
import { cn } from "@/lib/utils";
import { HomeIcon } from "./icon";
import { Photo } from "./ui";

export type SliderLabels = { region: string; slide: string; of: string; pause: string; play: string; goTo: string; photoSoon: string };

const isExternal = (url: string) => /^(https:|tel:|mailto:)/.test(url);

function Cta({ href, className, children, testid }: { href: string; className: string; children: React.ReactNode; testid?: string }) {
  return isExternal(href) ? (
    <a href={href} className={className} data-testid={testid} {...(href.startsWith("https:") ? { target: "_blank", rel: "noopener" } : {})}>{children}</a>
  ) : (
    <Link href={href} className={className} data-testid={testid}>{children}</Link>
  );
}

function Slide({ s, index, h1, whatsappHref, photoSoon }: { s: HeroSlide; index: number; h1: boolean; whatsappHref: string; photoSoon: string }) {
  const H = h1 && index === 0 ? "h1" : "h2";
  const secondaryHref = s.secondaryWhatsapp ? whatsappHref : s.secondaryUrl;
  return (
    <div className="relative h-full">
      {/* photo : moitié droite pleine hauteur à partir de 1024 px, fondue vers le texte */}
      <div className="absolute inset-y-0 end-0 hidden w-[54%] lg:block">
        <div className="relative h-full w-full [mask-image:linear-gradient(to_right,transparent,black_22%)] rtl:[mask-image:linear-gradient(to_left,transparent,black_22%)]">
          <HeroPhoto s={s} sizes="(min-width:1024px) 54vw, 1px" priority={index === 0} placeholder={photoSoon} />
        </div>
        <Highlight s={s} className="absolute end-[7%] bottom-[16%]" />
      </div>

      <div className="shell relative grid gap-8 pt-10 pb-6 sm:pt-14 lg:min-h-[34rem] lg:grid-cols-12 lg:items-center lg:pt-16 lg:pb-24 xl:min-h-[37rem]">
        <div className="lg:col-span-6 xl:col-span-5">
          {s.eyebrow && (
            <p className="eyebrow flex items-center gap-3 text-[0.8125rem] font-bold text-copper">
              {s.eyebrow}
              <span aria-hidden className="inline-block h-0.5 w-10 rounded bg-flame" />
            </p>
          )}
          <H className="mt-4 max-w-[15ch] text-[clamp(2.1rem,1.45rem+2.7vw,3.6rem)] leading-[1.07] font-bold tracking-[-0.025em] text-ink dark:text-foreground">{s.title}</H>
          {s.subtitle && <p className="mt-5 max-w-[42ch] text-[1.0625rem] leading-relaxed text-muted-foreground">{s.subtitle}</p>}

          {(s.primaryLabel || s.secondaryLabel) && (
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              {s.primaryLabel && s.primaryUrl && (
                <Cta href={s.primaryUrl} className="btn btn-primary group h-13 rounded-xl px-6 text-[0.9375rem] shadow-soft" testid="hero-quote">
                  <FileText className="size-[18px]" aria-hidden />
                  {s.primaryLabel}
                  <ArrowRight className="size-[18px] transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" aria-hidden />
                </Cta>
              )}
              {s.secondaryLabel && secondaryHref && (
                <Cta href={secondaryHref} className="btn h-13 rounded-xl border border-rule bg-card px-6 text-[0.9375rem] text-foreground shadow-soft hover:border-foreground/30" testid="hero-secondary">
                  {s.secondaryWhatsapp && <WhatsAppIcon className="size-[18px] text-wa" />}
                  {s.secondaryLabel}
                </Cta>
              )}
            </div>
          )}

          {s.badges.length > 0 && (
            <ul className="mt-9 flex flex-wrap gap-x-7 gap-y-4">
              {s.badges.map((b, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <HomeIcon name={b.icon} className="size-8 shrink-0 text-umber dark:text-copper" strokeWidth={1.5} />
                  <span className="text-[0.8125rem] leading-tight">
                    <span className="block font-bold text-foreground">{b.line1}</span>
                    {b.line2 && <span className="block text-muted-foreground">{b.line2}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* mobile / tablette : photo sous le texte */}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand shadow-soft sm:aspect-[16/10] lg:hidden">
          <HeroPhoto s={s} sizes="(min-width:640px) 90vw, 100vw" priority={index === 0} placeholder={photoSoon} />
          <Highlight s={s} className="absolute end-3 bottom-3 scale-90 origin-bottom-right rtl:origin-bottom-left" />
        </div>
      </div>
    </div>
  );
}

/**
 * Photo de la diapositive. « Photo entière » (Filament) : la photo est affichée sans recadrage, posée sur une copie floutée
 * d'elle-même qui remplit le reste du cadre (photo en hauteur d'une porte) ; sinon elle remplit tout le cadre.
 */
function HeroPhoto({ s, sizes, priority, placeholder }: { s: HeroSlide; sizes: string; priority: boolean; placeholder: string }) {
  if (!s.image || !s.imageWhole) return <Photo src={s.image} alt={s.imageAlt} sizes={sizes} priority={priority} placeholder={placeholder} />;
  return (
    <>
      <Image src={s.image} alt="" aria-hidden fill sizes="200px" className="scale-110 object-cover opacity-70 blur-2xl" />
      <Image
        src={s.image}
        alt={s.imageAlt}
        fill
        sizes={sizes}
        priority={priority}
        {...(priority ? { fetchPriority: "high" as const } : {})}
        className="object-contain drop-shadow-[0_20px_40px_rgb(58_36_22/0.18)]"
      />
    </>
  );
}

/** Pastille rouge (EI₂60 / EI₂90 / EI₂120) posée sur la photo. */
function Highlight({ s, className }: { s: HeroSlide; className?: string }) {
  if (!s.highlights.length) return null;
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl bg-fire px-4 py-3 text-white shadow-[0_18px_40px_-16px_rgb(198_40_40/0.7)]", className)}>
      {s.highlightIcon && (
        <span className="grid size-12 place-items-center rounded-full border-2 border-white/80">
          <HomeIcon name={s.highlightIcon} className="size-6" strokeWidth={1.8} />
        </span>
      )}
      <ul className="text-[1.0625rem] leading-tight font-bold" dir="ltr">
        {s.highlights.map((h, i) => (
          <li key={i}>{h.text}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Bannière défilante : toutes les diapositives sont rendues côté serveur dans la même cellule de grille
 * (hauteur = la plus haute, aucun décalage). Défilement auto en pause au survol / focus / onglet caché,
 * désactivé si l'utilisateur limite les animations ; points, flèches clavier, balayage tactile, bouton pause.
 */
export function HeroSlider({
  slides,
  autoplay,
  interval,
  whatsappHref,
  labels,
  h1 = true,
}: {
  slides: HeroSlide[];
  autoplay: boolean;
  interval: number;
  whatsappHref: string;
  labels: SliderLabels;
  h1?: boolean;
}) {
  const n = slides.length;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(autoplay && n > 1);
  const [hover, setHover] = useState(false);
  const [reduced, setReduced] = useState(false);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const go = useCallback((i: number) => setActive(((i % n) + n) % n), [n]);

  useEffect(() => {
    if (!playing || hover || reduced || n < 2) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setActive((a) => (a + 1) % n);
    }, Math.max(3, interval) * 1000);
    return () => window.clearInterval(id);
  }, [playing, hover, reduced, n, interval]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const rtl = document.documentElement.dir === "rtl";
    const forward = (e.key === "ArrowRight") !== rtl;
    go(active + (forward ? 1 : -1));
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.region}
      data-section="heroSlider"
      className="relative overflow-hidden bg-[linear-gradient(180deg,color-mix(in_oklab,var(--sand)_70%,var(--card)),var(--paper))] pb-16 lg:pb-24"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setHover(true)}
      onBlurCapture={() => setHover(false)}
      onKeyDown={onKey}
      onTouchStart={(e) => (touch.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touch.current;
        touch.current = null;
        const end = e.changedTouches[0]?.clientX;
        if (start == null || end == null || Math.abs(end - start) < 50 || n < 2) return;
        const rtl = document.documentElement.dir === "rtl";
        go(active + ((end < start) !== rtl ? 1 : -1));
      }}
    >
      {/* annonce la diapositive affichée seulement quand le défilement automatique est arrêté (WAI-ARIA carousel) */}
      <div className="grid" aria-live={playing && !reduced && !hover && n > 1 ? "off" : "polite"}>
        {slides.map((s, i) => (
          <div
            key={i}
            role={n > 1 ? "group" : undefined}
            aria-roledescription={n > 1 ? "slide" : undefined}
            aria-label={n > 1 ? `${labels.slide} ${i + 1} ${labels.of} ${n}` : undefined}
            aria-hidden={i !== active}
            inert={i !== active}
            className={cn("[grid-area:1/1] transition-opacity duration-700 ease-out motion-reduce:transition-none", i === active ? "opacity-100" : "pointer-events-none opacity-0")}
          >
            <Slide s={s} index={i} h1={h1} whatsappHref={whatsappHref} photoSoon={labels.photoSoon} />
          </div>
        ))}
      </div>

      {n > 1 && (
        <div className="absolute inset-x-0 bottom-14 flex items-center justify-center gap-2 lg:bottom-[3.75rem]">
          {slides.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`${labels.goTo} ${i + 1} : ${s.title}`}
              aria-current={i === active ? "true" : undefined}
              className="grid h-6 min-w-6 place-items-center rounded-full"
            >
              <span className={cn("block h-2 rounded-full transition-all duration-300", i === active ? "w-6 bg-flame" : "w-2 bg-foreground/25 hover:bg-foreground/45")} />
            </button>
          ))}
          {autoplay && !reduced && (
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? labels.pause : labels.play}
              className="ms-1 grid size-6 place-items-center rounded-full text-foreground/50 hover:text-foreground"
            >
              {playing ? <Pause className="size-3" aria-hidden /> : <Play className="size-3" aria-hidden />}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
