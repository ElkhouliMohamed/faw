"use client";
import { useT } from "./providers";
import { cn } from "@/lib/utils";

export function Steps({ current }: { current: 0 | 1 | 2 }) {
  const { t } = useT();
  return (
    <ol className="flex items-center gap-3 text-sm" aria-label="Étapes">
      {t.v2.steps.map((s, i) => (
        <li key={s} className="flex items-center gap-3" aria-current={i === current ? "step" : undefined}>
          <span className={cn("flex items-center gap-2", i === current ? "text-foreground" : "text-muted-foreground")}>
            <span className={cn("grid size-7 place-items-center rounded-full border text-xs tnum", i === current ? "border-primary bg-primary text-primary-foreground" : i < current ? "border-foreground/40" : "border-rule")} dir="ltr">
              0{i + 1}
            </span>
            <span className={cn("font-medium", i !== current && "hidden sm:inline")}>{s}</span>
          </span>
          {i < 2 && <span className="h-px w-6 bg-rule sm:w-10" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
