"use client";

import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { Moon, Sun, Languages } from "lucide-react";
import { setLocale } from "@/app/actions/locale";
import { useT } from "./providers";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={t.toggles.themeAria}
      aria-pressed={dark}
      data-testid="theme-toggle"
      className={cn("inline-flex size-11 items-center justify-center rounded-md text-foreground/80 transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", className)}
    >
      {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
    </button>
  );
}

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, t } = useT();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      lang={locale === "fr" ? "ar" : "fr"}
      aria-label={t.toggles.langAria}
      data-testid="locale-toggle"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const next = locale === "fr" ? "ar" : "fr";
          await setLocale(next);
          const p = window.location.pathname;
          let newPath = p;
          if (p.startsWith("/fr/") || p === "/fr") {
            newPath = `/${next}${p.slice(3)}`;
          } else if (p.startsWith("/ar/") || p === "/ar") {
            newPath = `/${next}${p.slice(3)}`;
          } else {
            newPath = `/${next}${p === "/" ? "" : p}`;
          }
          const u = new URL(window.location.href);
          u.pathname = newPath || `/${next}`;
          u.searchParams.delete("lang");
          window.location.replace(u.pathname + u.search + u.hash);
        })
      }
      className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-foreground/80 transition hover:bg-muted hover:text-foreground disabled:opacity-60", className)}
    >
      <Languages className="size-4" aria-hidden />
      {t.toggles.lang}
    </button>
  );
}
