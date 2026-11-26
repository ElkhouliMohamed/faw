"use client";

import Image from "next/image";
import { startTransition, useActionState, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateStockRow, type RowState } from "@/app/actions/stock";
import { AVAILABILITIES } from "@/lib/products";
import { cn } from "@/lib/utils";

type P = { id: string; slug: string; title: string; image: string | null; price: number; stockQty: number | null; availability: string; active: boolean; flags: string[] };

const ctl = "h-11 rounded-lg border border-input bg-background px-3 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

export function StockRow({ p }: { p: P }) {
  const [state, action, pending] = useActionState<RowState, FormData>(updateStockRow, null);
  const [dirty, setDirty] = useState(false);
  const form = `row-${p.id}`;
  const effective = p.availability === "en stock" && p.stockQty === 0 ? "indisponible (stock 0)" : null;
  return (
    <tr className={cn("border-t border-border align-middle", !p.active && "opacity-55")} data-testid={`stock-row-${p.id}`} onChange={() => setDirty(true)}>
      <td className="px-3 py-2.5">
        <form
          id={form}
          onSubmit={(ev) => {
            ev.preventDefault();
            const fd = new FormData(ev.currentTarget);
            setDirty(false);
            startTransition(() => action(fd));
          }}
        />
        <input type="hidden" name="id" value={p.id} form={form} />
        <div className="flex items-center gap-3">
          <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">
            {p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}
          </div>
          <div className="min-w-0">
            <a href={`/produits/${p.slug}`} target="_blank" className="font-medium hover:underline">{p.title}</a>
            <p className="font-mono text-xs text-muted-foreground">{p.id}</p>
            {(p.flags.length > 0 || effective) && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">{[...p.flags, effective].filter(Boolean).join(" · ")}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <input form={form} name="price" defaultValue={p.price} inputMode="numeric" aria-label={`Prix TTC ${p.id}`} className={cn(ctl, "w-28 tabular-nums")} data-testid="stock-price" />
      </td>
      <td className="px-3 py-2.5">
        <input form={form} name="stockQty" defaultValue={p.stockQty ?? ""} placeholder="non suivi" inputMode="numeric" aria-label={`Quantité en stock ${p.id}`} className={cn(ctl, "w-28 tabular-nums")} data-testid="stock-qty" />
      </td>
      <td className="px-3 py-2.5">
        <select form={form} name="availability" defaultValue={p.availability} aria-label={`Disponibilité ${p.id}`} className={cn(ctl, "w-48")} data-testid="stock-availability">
          {AVAILABILITIES.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </td>
      <td className="px-3 py-2.5">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input form={form} type="checkbox" name="active" value="1" defaultChecked={p.active} className="size-5 accent-[var(--primary)]" data-testid="stock-active" />
          <span className="sr-only">En ligne</span>
        </label>
      </td>
      <td className="px-3 py-2.5 text-right">
        <button form={form} type="submit" disabled={pending} className={cn("inline-flex h-11 min-w-32 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold", dirty ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted")} data-testid="stock-save">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : state?.ok && !dirty ? <Check className="size-4" aria-hidden /> : null}
          {pending ? "…" : state?.ok && !dirty ? "Enregistré" : "Enregistrer"}
        </button>
        {state && !state.ok && <p role="alert" className="mt-1 text-xs text-destructive">{state.message}</p>}
      </td>
    </tr>
  );
}
