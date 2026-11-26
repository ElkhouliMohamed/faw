"use client";
import { useActionState, useState } from "react";
import { deleteMedia, updateMediaAlt, uploadMedia } from "@/app/actions/media";
import { btnCls, btnGhost, inputCls } from "../ui";

export function MediaUpload() {
  const [st, act, pending] = useActionState(uploadMedia, null);
  return (
    <form action={act} className="mt-5 grid max-w-2xl gap-2 rounded-[2px] border border-border bg-card p-4" data-testid="media-upload">
      <input type="file" name="files" multiple accept="image/jpeg,image/png,image/webp" aria-label="Images" className="text-sm" data-testid="media-file" />
      <input name="alt" maxLength={160} placeholder="Texte alternatif (description de l'image)" aria-label="Texte alternatif" className={inputCls} />
      <div className="flex flex-wrap items-center gap-3">
        <button className={btnCls} disabled={pending} data-testid="media-submit">{pending ? "Envoi…" : "Téléverser"}</button>
        {st && <p className={st.ok ? "text-sm text-emerald-700 dark:text-emerald-300" : "text-sm text-destructive"} role={st.ok ? "status" : "alert"} data-testid="media-result">{st.message}</p>}
      </div>
    </form>
  );
}

type M = { id: number; url: string; alt: string; width: number | null; height: number | null; size: number; originalName: string | null };
export function MediaCard({ m, write }: { m: M; write: boolean }) {
  const [alt, altAct, altPending] = useActionState(updateMediaAlt, null);
  const [del, delAct, delPending] = useActionState(deleteMedia, null);
  const [copied, setCopied] = useState(false);
  return (
    <li className="min-w-0 rounded-[2px] border border-border bg-card p-2 text-xs" data-testid="media-item" data-url={m.url}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.url} alt={m.alt} loading="lazy" className="aspect-square w-full rounded-[2px] bg-muted object-cover" />
      <p className="mt-1 truncate font-mono" title={m.url}>{m.url}</p>
      <p className="text-muted-foreground">{m.width}×{m.height} · {Math.round(m.size / 1024)} Ko</p>
      <button type="button" className="mt-1 text-copper hover:underline" onClick={() => navigator.clipboard?.writeText(m.url).then(() => setCopied(true))}>{copied ? "Copié" : "Copier le chemin"}</button>
      {write ? (
        <>
          <form action={altAct} className="mt-2 flex gap-1">
            <input type="hidden" name="id" value={m.id} />
            <input name="alt" defaultValue={m.alt} maxLength={160} aria-label="Texte alternatif" placeholder="Texte alternatif" className="h-8 min-w-0 flex-1 rounded-[2px] border border-input bg-background px-2" />
            <button className={`${btnGhost} h-8 px-2 text-xs`} disabled={altPending}>OK</button>
          </form>
          {alt && <p className={alt.ok ? "text-emerald-700" : "text-destructive"}>{alt.message}</p>}
          <form action={delAct} onSubmit={(e) => { if (!window.confirm("Supprimer cette image ?")) e.preventDefault(); }} className="mt-1">
            <input type="hidden" name="id" value={m.id} />
            <button className="text-destructive hover:underline" disabled={delPending} data-testid="media-delete">Supprimer</button>
          </form>
          {del && !del.ok && <p className="text-destructive" role="alert" data-testid="media-delete-error">{del.message}</p>}
        </>
      ) : (
        <p className="mt-1 text-muted-foreground">{m.alt || "Sans texte alternatif"}</p>
      )}
    </li>
  );
}
