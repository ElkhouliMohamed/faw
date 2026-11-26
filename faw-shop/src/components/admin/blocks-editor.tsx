"use client";
import { useState } from "react";
import { BLOCK_TYPES, type Block } from "@/lib/admin/crud-types";
import type { MediaItem } from "./crud-form";

const input = "h-9 w-full rounded-[2px] border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring";
const area = "w-full rounded-[2px] border border-input bg-background p-2.5 text-sm outline-none focus-visible:border-ring";

function blank(t: Block["type"]): Block {
  switch (t) {
    case "hero": return { type: "hero", title: "", subtitle: "", ctaLabel: "", ctaUrl: "", image: "" };
    case "products": return { type: "products", title: "", ids: [] };
    case "text": return { type: "text", title: "", body: "" };
    case "faq": return { type: "faq", title: "", items: [{ q: "", a: "" }] };
    case "cta": return { type: "cta", title: "", text: "", label: "", url: "/devis" };
  }
}
function parse(v: string): Block[] {
  try {
    const a = JSON.parse(v);
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
}

export function BlocksEditor({ name, value, disabled, media }: { name: string; value: string; disabled: boolean; media: MediaItem[] }) {
  const [blocks, setBlocks] = useState<Block[]>(() => parse(value));
  const set = (i: number, b: Block) => setBlocks((x) => x.map((y, j) => (j === i ? b : y)));
  const move = (i: number, d: number) => setBlocks((x) => { const y = [...x]; const [b] = y.splice(i, 1); y.splice(Math.max(0, Math.min(y.length, i + d)), 0, b); return y; });
  const label = (t: string) => BLOCK_TYPES.find((b) => b.type === t)?.label ?? t;
  const txt = (i: number, b: Block, k: string, l: string, opts: { area?: boolean; ph?: string } = {}) => {
    const val = String((b as Record<string, unknown>)[k] ?? "");
    const on = (v: string) => set(i, { ...b, [k]: v } as Block);
    return (
      <label className="grid gap-1 text-xs font-medium">
        {l}
        {opts.area ? <textarea className={area} rows={5} value={val} disabled={disabled} onChange={(e) => on(e.target.value)} /> : <input className={input} value={val} placeholder={opts.ph} disabled={disabled} onChange={(e) => on(e.target.value)} />}
      </label>
    );
  };
  return (
    <div className="grid gap-3" data-testid="blocks-editor">
      <input type="hidden" name={name} value={JSON.stringify(blocks)} />
      {blocks.map((b, i) => (
        <div key={i} className="grid gap-2 rounded-[2px] border border-border p-3" data-testid="block" data-type={b.type}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="label-mono text-[0.7rem] text-copper">{i + 1}. {label(b.type)}</p>
            {!disabled && (
              <div className="flex gap-1 text-xs">
                <button type="button" className="rounded border border-border px-2 py-0.5" onClick={() => move(i, -1)} aria-label="Monter">↑</button>
                <button type="button" className="rounded border border-border px-2 py-0.5" onClick={() => move(i, 1)} aria-label="Descendre">↓</button>
                <button type="button" className="rounded border border-destructive/40 px-2 py-0.5 text-destructive" onClick={() => setBlocks((x) => x.filter((_, j) => j !== i))}>Retirer</button>
              </div>
            )}
          </div>
          {b.type === "hero" && (<>{txt(i, b, "title", "Titre")}{txt(i, b, "subtitle", "Sous-titre")}<div className="grid gap-2 sm:grid-cols-2">{txt(i, b, "ctaLabel", "Bouton")}{txt(i, b, "ctaUrl", "Lien du bouton", { ph: "/devis" })}</div>
            <label className="grid gap-1 text-xs font-medium">Image (médiathèque)
              <select className={input} value={b.image ?? ""} disabled={disabled} onChange={(e) => set(i, { ...b, image: e.target.value })}>
                <option value="">Aucune</option>
                {media.map((m) => <option key={m.url} value={m.url}>{m.alt || m.url}</option>)}
              </select>
            </label></>)}
          {b.type === "products" && (<>{txt(i, b, "title", "Titre")}
            <label className="grid gap-1 text-xs font-medium">Références produits (séparées par des virgules)
              <input className={`${input} font-mono`} value={b.ids.join(", ")} disabled={disabled} onChange={(e) => set(i, { ...b, ids: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
            </label></>)}
          {b.type === "text" && (<>{txt(i, b, "title", "Titre")}{txt(i, b, "body", "Texte (paragraphes séparés par une ligne vide)", { area: true })}</>)}
          {b.type === "cta" && (<>{txt(i, b, "title", "Titre")}{txt(i, b, "text", "Texte")}<div className="grid gap-2 sm:grid-cols-2">{txt(i, b, "label", "Bouton")}{txt(i, b, "url", "Lien", { ph: "/devis" })}</div></>)}
          {b.type === "faq" && (<>{txt(i, b, "title", "Titre")}
            {b.items.map((it, k) => (
              <div key={k} className="grid gap-1 border-s-2 border-border ps-2">
                <input className={input} placeholder="Question" value={it.q} disabled={disabled} onChange={(e) => set(i, { ...b, items: b.items.map((x, j) => (j === k ? { ...x, q: e.target.value } : x)) })} aria-label={`Question ${k + 1}`} />
                <textarea className={area} rows={2} placeholder="Réponse" value={it.a} disabled={disabled} onChange={(e) => set(i, { ...b, items: b.items.map((x, j) => (j === k ? { ...x, a: e.target.value } : x)) })} aria-label={`Réponse ${k + 1}`} />
                {!disabled && <button type="button" className="justify-self-start text-xs text-destructive" onClick={() => set(i, { ...b, items: b.items.filter((_, j) => j !== k) })}>Retirer la question</button>}
              </div>
            ))}
            {!disabled && <button type="button" className="justify-self-start text-xs font-semibold text-copper" onClick={() => set(i, { ...b, items: [...b.items, { q: "", a: "" }] })}>+ Question</button>}</>)}
        </div>
      ))}
      {!blocks.length && <p className="text-xs text-muted-foreground">Aucun bloc.</p>}
      {!disabled && (
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((t) => (
            <button key={t.type} type="button" className="rounded-full border border-border px-3 py-1 text-xs font-medium hover:bg-muted" onClick={() => setBlocks((x) => [...x, blank(t.type)])} data-testid={`block-add-${t.type}`}>
              + {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
