"use client";

import { startTransition, useActionState, useState } from "react";
import { CheckCircle2, Download, Loader2, Mail, Send, XCircle } from "lucide-react";
import { cancelQuote, markQuoteSent, resendQuoteEmail, updateQuoteQuantities, validateQuote, type DevisActionState } from "@/app/actions/devis-admin";
import { cn } from "@/lib/utils";
import { CopyButton } from "../copy-button";

type Act = (p: DevisActionState, fd: FormData) => Promise<DevisActionState>;

function useAct(fn: Act) {
  const [state, action, pending] = useActionState<DevisActionState, FormData>(fn, null);
  const onSubmit = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const fd = new FormData(ev.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, pending, onSubmit };
}

function Msg({ state, testId }: { state: DevisActionState; testId: string }) {
  if (!state) return null;
  return (
    <p role="status" data-testid={testId} className={cn("mt-3 rounded-lg px-3 py-2 text-sm font-medium", state.ok ? "bg-emerald-600/12 text-emerald-800 dark:text-emerald-200" : "bg-destructive/12 text-destructive")}>
      {state.message}
    </p>
  );
}

const big = "inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-bold disabled:opacity-60";

export function ValidateButton({ id, hint }: { id: number; hint: string }) {
  const { state, pending, onSubmit } = useAct(validateQuote);
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className={cn(big, "w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto")} data-testid="devis-valider">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <CheckCircle2 className="size-5" />} Valider le devis
      </button>
      <p className="mt-2 max-w-md text-xs text-muted-foreground" data-testid="devis-valider-hint">{hint}</p>
      <Msg state={state} testId="devis-valider-msg" />
    </form>
  );
}

export function CancelForm({ id }: { id: number }) {
  const { state, pending, onSubmit } = useAct(cancelQuote);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={cn(big, "w-full border-2 border-destructive/40 text-destructive hover:bg-destructive/10 sm:w-auto")} data-testid="devis-refuser">
        <XCircle className="size-5" /> Refuser / annuler
      </button>
    );
  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-destructive/40 p-4">
      <input type="hidden" name="id" value={id} />
      <label className="block text-sm font-medium" htmlFor="cancel-reason">Motif (facultatif, visible uniquement par l&apos;équipe)</label>
      <textarea id="cancel-reason" name="reason" maxLength={300} rows={2} className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm" data-testid="devis-refus-motif" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={pending} className={cn(big, "h-12 bg-destructive text-white")} data-testid="devis-refus-confirmer">
          {pending && <Loader2 className="size-5 animate-spin" />} Confirmer le refus
        </button>
        <button type="button" onClick={() => setOpen(false)} className={cn(big, "h-12 border border-border")}>Retour</button>
      </div>
      <Msg state={state} testId="devis-refus-msg" />
    </form>
  );
}

type Line = { id: string; title: string; qty: number; unit: number; total: number; tier?: boolean };

export function LinesEditor({ id, lines, editable }: { id: number; lines: Line[]; editable: boolean }) {
  const { state, pending, onSubmit } = useAct(updateQuoteQuantities);
  const fmt = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n).replace(/\u202f|\u00a0/g, " ")} DH`;
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[34rem] text-sm" data-testid="devis-lines">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2">Produit</th>
              <th scope="col" className="px-3 py-2 text-right">PU TTC</th>
              <th scope="col" className="px-3 py-2 text-right">Qté</th>
              <th scope="col" className="px-3 py-2 text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2">{l.title}<span className="block font-mono text-xs text-muted-foreground">{l.id}{l.tier ? " · tarif dès 4 portes" : ""}</span></td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmt(l.unit)}</td>
                <td className="px-3 py-2 text-right">
                  {editable ? (
                    <input name={`qty:${l.id}`} defaultValue={l.qty} inputMode="numeric" aria-label={`Quantité ${l.id}`} className="h-10 w-20 rounded-lg border border-input bg-background px-2 text-right tabular-nums" data-testid="devis-qty" />
                  ) : (
                    <span className="tabular-nums">{l.qty}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">{fmt(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold hover:bg-muted" data-testid="devis-qty-save">
            {pending && <Loader2 className="size-4 animate-spin" />} Enregistrer les quantités
          </button>
          <span className="text-xs text-muted-foreground">0 retire la ligne. Prix et règles recalculés avec le catalogue actuel.</span>
        </div>
      )}
      <Msg state={state} testId="devis-qty-msg" />
    </form>
  );
}

export function SendPanel({ id, number, message, waHref }: { id: number; number: string; message: string; waHref: string | null }) {
  const { state, pending, onSubmit } = useAct(markQuoteSent);
  return (
    <div className="space-y-5">
      <ol className="space-y-4 text-sm">
        <li>
          <p className="font-semibold">1. Télécharger le PDF définitif</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a href={`/admin/devis/${id}/pdf?dl=1`} className={cn(big, "h-12 bg-primary text-primary-foreground")} data-testid="devis-final-download"><Download className="size-5" /> Devis-{number}-FAW.pdf</a>
            <a href={`/admin/devis/${id}/pdf`} target="_blank" className={cn(big, "h-12 border border-border")}>Ouvrir</a>
          </div>
        </li>
        <li>
          <p className="font-semibold">2. Copier le message WhatsApp</p>
          <p className="mt-2 rounded-lg border border-border bg-muted/40 p-3" data-testid="devis-wa-message">{message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={message} />
            {waHref ? (
              <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-full bg-[#25D366] px-4 text-sm font-semibold text-black" data-testid="devis-wa-link">
                Ouvrir WhatsApp avec le client
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">Numéro client absent : copiez le message.</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">WhatsApp s&apos;ouvre avec le message pré-rempli (avec le lien privé du devis). Joignez le PDF si besoin et envoyez vous-même : le site n&apos;envoie rien sur WhatsApp.</p>
        </li>
        <li>
          <p className="font-semibold">3. Une fois envoyé au client</p>
          <form onSubmit={onSubmit} className="mt-2">
            <input type="hidden" name="id" value={id} />
            <button disabled={pending} className={cn(big, "bg-emerald-600 text-white hover:bg-emerald-700")} data-testid="devis-marquer-envoye">
              {pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />} Marquer comme envoyé
            </button>
            <p className="mt-2 text-xs text-muted-foreground">Ajoute la ligne au journal des devis, note l&apos;envoi dans la fiche client et passe la demande en « devis envoyé ».</p>
            <Msg state={state} testId="devis-envoye-msg" />
          </form>
        </li>
      </ol>
    </div>
  );
}

export function ResendEmailButton({ id }: { id: number }) {
  const { state, pending, onSubmit } = useAct(resendQuoteEmail);
  return (
    <form onSubmit={onSubmit} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-primary px-5 text-sm font-semibold hover:bg-muted disabled:opacity-60" data-testid="devis-email-resend">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Renvoyer l&apos;email
      </button>
      <Msg state={state} testId="devis-email-resend-msg" />
    </form>
  );
}
