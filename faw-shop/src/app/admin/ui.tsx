import { formatDH } from "@/lib/format";
import { cn } from "@/lib/utils";

export const STATUS_STYLE: Record<string, string> = {
  nouveau: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  "contacté": "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "devis envoyé": "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  "gagné": "bg-emerald-600/12 text-emerald-700 dark:text-emerald-300",
  perdu: "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
  "à valider": "bg-amber-500/20 text-amber-900 dark:text-amber-200",
  "validé": "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  "envoyé": "bg-emerald-600/12 text-emerald-700 dark:text-emerald-300",
  "refusé": "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[status] ?? "bg-muted")}>{status}</span>;
}

export function Money({ v }: { v: number }) {
  return <span className="whitespace-nowrap">{formatDH(v)}</span>;
}

export const inputCls = "h-10 w-full rounded-[2px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
export const btnCls = "inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:brightness-110";
export const btnGhost = "inline-flex h-9 items-center justify-center rounded-full border border-border px-3 text-sm font-medium hover:bg-muted";
