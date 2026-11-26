"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { createProduct, type NewProductState } from "@/app/actions/stock";
import { AVAILABILITIES } from "@/lib/products";
import { cn } from "@/lib/utils";

const ctl = "h-12 w-full rounded-lg border border-input bg-background px-3.5 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive";

export function NewProductForm({ categories }: { categories: string[] }) {
  const [state, action, pending] = useActionState<NewProductState, FormData>(createProduct, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const e = state?.errors ?? {};
  return (
    <form
      ref={ref}
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
      className="mt-6 grid gap-5 sm:grid-cols-2" data-testid="new-product-form">
      <F e={e} name="title" label="Nom du produit" hint="Court et clair, ex. « Porte coupe-feu EI60 vitrée »" className="sm:col-span-2">
        <input id="np-title" name="title" maxLength={70} required className={ctl} aria-invalid={!!e.title} />
      </F>
      <F e={e} name="id" label="Référence" hint="Lettres, chiffres, tirets (ex. CF-EI60-VIT)">
        <input id="np-id" name="id" required className={cn(ctl, "font-mono uppercase")} aria-invalid={!!e.id} />
      </F>
      <F e={e} name="category" label="Catégorie">
        <select id="np-category" name="category" className={ctl}>{categories.map((c) => <option key={c}>{c}</option>)}</select>
      </F>
      <F e={e} name="price" label="Prix TTC (DH)" hint="Prix de base ; chaque variante peut avoir son propre prix">
        <input id="np-price" name="price" inputMode="numeric" required className={ctl} aria-invalid={!!e.price} />
      </F>
      <F e={e} name="photo" label="Photo" hint="JPEG, PNG ou WebP, 5 Mo maximum">
        <input id="np-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:me-3 file:h-11 file:rounded-full file:border-0 file:bg-muted file:px-4 file:font-semibold" />
      </F>
      <F e={e} name="availability" label="Disponibilité">
        <select id="np-availability" name="availability" className={ctl}>{AVAILABILITIES.map((a) => <option key={a}>{a}</option>)}</select>
      </F>
      <F e={e} name="stockQty" label="Quantité en stock" hint="Laisser vide si non suivi">
        <input id="np-stockQty" name="stockQty" inputMode="numeric" className={ctl} />
      </F>
      <F e={e} name="description" label="Description courte" hint="2 ou 3 phrases : usage, dimensions, ce qui est inclus" className="sm:col-span-2">
        <textarea id="np-description" name="description" rows={3} maxLength={600} required className={cn(ctl, "h-auto py-3")} aria-invalid={!!e.description} />
      </F>
      <F e={e} name="variants" label="Tailles (facultatif)" hint="Une taille par ligne : « 90 cm ; 2200 ». Laisser vide pour un produit unique." className="sm:col-span-2">
        <textarea id="np-variants" name="variants" rows={3} placeholder={"80 cm ; 2200\n90 cm ; 2200"} className={cn(ctl, "h-auto py-3 font-mono")} aria-invalid={!!e.variants} />
      </F>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <button type="submit" disabled={pending} className="inline-flex h-12 items-center rounded-full bg-primary px-6 font-semibold text-primary-foreground disabled:opacity-60" data-testid="new-product-submit">
          {pending ? "Enregistrement…" : "Ajouter le produit"}
        </button>
        {state && <p role="status" className={cn("text-sm font-medium", state.ok ? "text-emerald-700 dark:text-emerald-300" : "text-destructive")} data-testid="new-product-status">{state.message}</p>}
      </div>
    </form>
  );
}

function F({ e, name, label, hint, children, className }: { e: Record<string, string>; name: string; label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={`np-${name}`} className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {e[name] && <p className="mt-1 text-xs font-medium text-destructive" role="alert">{e[name]}</p>}
    </div>
  );
}
