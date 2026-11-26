"use client";

import { useEffect, useRef } from "react";
import { Logo } from "./logo";
import { useT } from "./providers";

const KEY = "faw-intro-v3";

/**
 * Script inline exécuté pendant le parsing (avant le 1er rendu) : décide si l'intro joue.
 * Jamais si « réduire les animations », ni si déjà vue dans la session (sessionStorage).
 * Le hero est rendu dessous : l'intro n'est qu'un calque fixe, retiré en 2,0 s (CSS pur, démarre au 1er rendu).
 */
export const introScript = `try{var d=document.documentElement;if(!sessionStorage.getItem("${KEY}")&&!matchMedia("(prefers-reduced-motion: reduce)").matches){d.dataset.intro="play";sessionStorage.setItem("${KEY}","1")}}catch(e){}`;

export function Intro() {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (root.dataset.intro !== "play" || !el) return;
    const done = () => {
      root.dataset.intro = "done";
      cleanup();
    };
    const skip = () => {
      if (root.dataset.intro === "play") root.dataset.intro = "skip";
    };
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && (e.animationName === "intro-out" || e.animationName === "intro-skip")) done();
    };
    const onKey = () => skip();
    const cleanup = () => {
      el.removeEventListener("animationend", onEnd);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("pointerdown", skip);
    };
    el.addEventListener("animationend", onEnd);
    el.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", onKey);
    // filet de sécurité : retiré même si animationend est manqué (animation : 2,0 s)
    const timer = window.setTimeout(done, 2150);
    return () => {
      window.clearTimeout(timer);
      cleanup();
      if (root.dataset.intro === "play" || root.dataset.intro === "skip") root.dataset.intro = "done";
    };
  }, []);

  return (
    <div ref={ref} className="intro fixed inset-0 z-[70] flex-col items-center justify-center bg-background" data-testid="intro">
      <div className="shell flex flex-col items-center text-center" aria-hidden>
        <Logo className="intro-logo h-14 sm:h-20" sizes="(min-width:640px) 320px, 220px" />
        <span className="intro-rule mt-8 block h-px w-24 bg-copper sm:w-32" />
        <p className="intro-line mt-8 max-w-[20ch] text-d2 font-semibold">{t.v3.introLine}</p>
        <p className="intro-line eyebrow mt-4 leading-relaxed text-muted-foreground [text-wrap:balance]">{t.v3.introSub}</p>
      </div>
      <button
        type="button"
        onClick={() => (document.documentElement.dataset.intro = "skip")}
        aria-label={t.v3.introSkipAria}
        className="eyebrow absolute end-4 bottom-4 inline-flex h-10 items-center rounded-lg px-3 text-muted-foreground transition-colors hover:text-foreground sm:end-8 sm:bottom-8"
      >
        {t.v3.introSkip} <span aria-hidden className="ms-2">→</span>
      </button>
    </div>
  );
}
