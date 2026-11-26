"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { useCart, useShop, useT } from "./providers";
import { cn } from "@/lib/utils";

/** Ajout rapide (quantité 1) depuis une carte produit. */
export function QuickAdd({ id, title, className, full = false, disabled = false }: { id: string; title: string; className?: string; full?: boolean; disabled?: boolean }) {
  const { t } = useT();
  const { showPrices } = useShop();
  const { add } = useCart();
  const addLabel = showPrices ? t.product.add : t.product.addQuote;
  const addedLabel = showPrices ? t.product.added : t.product.addedQuote;
  const shortLabel = showPrices ? t.v3.addShort : t.product.addQuoteShort;
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-testid="quick-add"
      disabled={disabled}
      onClick={() => {
        add(id, 1);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      aria-label={`${addLabel} : ${title}`}
      className={cn(
        "relative z-10 inline-flex min-h-11 min-w-0 shrink-0 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold leading-tight transition-colors",
        disabled ? "cursor-not-allowed border-input text-muted-foreground opacity-60" : done ? "border-primary bg-primary text-primary-foreground" : "border-input text-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
        full ? "h-12 w-full px-4 whitespace-nowrap" : "h-auto w-full px-3 py-2 text-center whitespace-normal",
        className,
      )}
    >
      {done ? <Check className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
      <span aria-live="polite">{disabled ? t.v4.unavailable : done ? addedLabel : full ? addLabel : shortLabel}</span>
    </button>
  );
}
