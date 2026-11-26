"use client";
import { useActionState, useState } from "react";
import { createManual } from "@/app/actions/crm";
import { LEAD_STATUSES } from "@/lib/crm";
import { btnCls, inputCls } from "../../ui";

export function ManualForm() {
  const [state, action, pending] = useActionState(createManual, null);
  const [withLead, setWithLead] = useState(true);
  return (
    <form action={action} className="mt-6 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      <label>Nom *<input name="name" required className={inputCls} /></label>
      <label>Téléphone *<input name="phone" required inputMode="tel" placeholder="06…" className={inputCls} /></label>
      <label>E-mail<input name="email" type="email" className={inputCls} /></label>
      <label>Ville<input name="city" className={inputCls} /></label>
      <label>Type<select name="type" className={inputCls}><option value="particulier">particulier</option><option value="entreprise">entreprise</option></select></label>
      <label>Source<select name="source" className={inputCls}>{["téléphone", "visite", "whatsapp", "salon", "recommandation", "autre"].map((s) => <option key={s}>{s}</option>)}</select></label>
      <label>Société<input name="company" className={inputCls} /></label>
      <label>ICE<input name="ice" className={inputCls} /></label>
      <label className="sm:col-span-2">Tags (virgules)<input name="tags" placeholder="revendeur, chantier" className={inputCls} /></label>
      <label className="flex items-center gap-2 sm:col-span-2">
        <input type="checkbox" name="withLead" checked={withLead} onChange={(e) => setWithLead(e.target.checked)} className="size-4 accent-[var(--copper)]" />
        Créer aussi un lead dans le pipeline
      </label>
      {withLead && (
        <>
          <label>Valeur estimée (DH TTC)<input name="value" inputMode="numeric" placeholder="0" className={inputCls} /></label>
          <label>Statut<select name="status" className={inputCls}>{LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label className="sm:col-span-2">Besoin<textarea name="leadNote" rows={3} placeholder="Ex. 4 portes coupe-feu EI60 1 vantail pour parking" className={`${inputCls} h-auto py-2`} /></label>
        </>
      )}
      {state?.error && <p role="alert" className="text-destructive sm:col-span-2">{state.error}</p>}
      <div className="sm:col-span-2"><button disabled={pending} className={btnCls}>{pending ? "…" : "Créer"}</button></div>
    </form>
  );
}
