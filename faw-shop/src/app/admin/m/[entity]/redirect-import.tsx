"use client";
import { useActionState } from "react";
import { importRedirects } from "@/app/actions/redirects";
import { btnGhost } from "../../ui";

export function RedirectImport() {
  const [st, act, pending] = useActionState(importRedirects, null);
  return (
    <details className="mt-4 max-w-2xl rounded-[2px] border border-border bg-card p-3" data-testid="redirect-import">
      <summary className="cursor-pointer text-sm font-semibold">Importer un CSV</summary>
      <form action={act} className="mt-3 grid gap-2">
        <textarea name="csv" rows={4} placeholder={"source,destination,code\n/ancienne-page,/produits,301"} className="w-full rounded-[2px] border border-input bg-background p-2 font-mono text-xs" aria-label="Lignes CSV" data-testid="redirect-csv" />
        <input type="file" name="file" accept=".csv,text/csv,text/plain" aria-label="Fichier CSV" className="text-sm" />
        <div className="flex items-center gap-3">
          <button className={btnGhost} disabled={pending} data-testid="redirect-import-submit">{pending ? "Import…" : "Importer"}</button>
          {st && !st.ok && <p className="text-sm text-destructive" role="alert" data-testid="redirect-import-error">{st.message}</p>}
        </div>
      </form>
    </details>
  );
}
