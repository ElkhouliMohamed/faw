"use client";
import { useActionState, useState, useTransition } from "react";
import { deleteEntity, saveEntity } from "@/app/actions/crud";
import type { CrudState, FieldSpec } from "@/lib/admin/crud-types";
import { BlocksEditor } from "./blocks-editor";

const input = "h-10 w-full rounded-[2px] border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70";
const area = "w-full rounded-[2px] border border-input bg-background p-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-70";
export type MediaItem = { url: string; alt: string };
type Values = Record<string, string | string[] | boolean>;

function MultiSelect({ f, value, disabled }: { f: FieldSpec; value: string[]; disabled: boolean }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>(value);
  const opts = f.options ?? [];
  const shown = q ? opts.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : opts;
  return (
    <div className="rounded-[2px] border border-input" data-testid={`multi-${f.name}`}>
      {sel.map((v) => <input key={v} type="hidden" name={f.name} value={v} />)}
      {opts.length > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrer…" aria-label={`Filtrer ${f.label}`} className="h-9 w-full border-b border-input bg-background px-3 text-sm outline-none" />}
      <div className="max-h-56 overflow-y-auto p-2">
        {shown.map((o) => (
          <label key={o.value} className="flex items-center gap-2 py-1 text-sm">
            <input type="checkbox" disabled={disabled} checked={sel.includes(o.value)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, o.value] : s.filter((x) => x !== o.value)))} data-value={o.value} />
            <span className="min-w-0 break-words">{o.label}</span>
          </label>
        ))}
        {!opts.length && <p className="text-xs text-muted-foreground">Aucune option disponible.</p>}
      </div>
      <p className="border-t border-input px-3 py-1 text-xs text-muted-foreground">{sel.length} sélectionné(s)</p>
    </div>
  );
}

function ImageField({ f, value, media, disabled }: { f: FieldSpec; value: string; media: MediaItem[]; disabled: boolean }) {
  const [v, setV] = useState(value);
  return (
    <div className="grid gap-2">
      <div className="flex gap-2">
        <input name={f.name} value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} placeholder="/media/…" className={input} id={`f-${f.name}`} list={`media-${f.name}`} />
        <datalist id={`media-${f.name}`}>{media.map((m) => <option key={m.url} value={m.url}>{m.alt}</option>)}</datalist>
      </div>
      {v && /^\/(?!\/)/.test(v) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v} alt="" className="h-24 w-24 rounded-[2px] border border-border object-cover" />
      )}
      {!disabled && media.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Médiathèque">
          {media.slice(0, 24).map((m) => (
            <button key={m.url} type="button" onClick={() => setV(m.url)} className="rounded-[2px] border border-border p-0.5 hover:border-copper" title={m.alt || m.url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt} className="h-12 w-12 object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ f, v, err, media, disabled, isCreate }: { f: FieldSpec; v: Values[string]; err?: string; media: MediaItem[]; disabled: boolean; isCreate: boolean }) {
  const id = `f-${f.name}`;
  const dis = disabled || (!!f.createOnly && !isCreate);
  const common = { id, name: f.name, disabled: dis, "aria-invalid": err ? true : undefined, "aria-describedby": err ? `${id}-err` : f.help ? `${id}-help` : undefined };
  let control: React.ReactNode;
  switch (f.type) {
    case "bool":
      return (
        <div className="flex items-start gap-2 py-1">
          <input type="checkbox" value="1" defaultChecked={Boolean(v)} {...common} className="mt-1 size-4" />
          <label htmlFor={id} className="text-sm font-medium">{f.label}{f.help && <span id={`${id}-help`} className="block text-xs font-normal text-muted-foreground">{f.help}</span>}</label>
        </div>
      );
    case "textarea":
    case "markdown":
    case "lines":
      control = <textarea {...common} defaultValue={String(v ?? "")} rows={f.rows ?? (f.type === "markdown" ? 14 : 4)} maxLength={f.max} placeholder={f.placeholder} className={`${area} ${f.type === "lines" ? "font-mono text-xs" : ""}`} />;
      break;
    case "select":
      control = (
        <select {...common} defaultValue={String(v ?? "")} className={input}>
          {!f.required && !(f.options ?? []).some((o) => o.value === "") && <option value="">—</option>}
          {(f.options ?? []).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;
    case "multi":
      control = <MultiSelect f={f} value={Array.isArray(v) ? v : []} disabled={dis} />;
      break;
    case "image":
      control = <ImageField f={f} value={String(v ?? "")} media={media} disabled={dis} />;
      break;
    case "blocks":
      control = <BlocksEditor name={f.name} value={String(v || "[]")} disabled={dis} media={media} />;
      break;
    case "password":
      control = <input {...common} type="password" autoComplete="new-password" defaultValue="" maxLength={f.max} className={input} />;
      break;
    default: {
      const type = f.type === "int" || f.type === "money" ? "number" : f.type === "datetime" ? "datetime-local" : f.type === "email" ? "email" : f.type === "color" ? "color" : "text";
      control = (
        <input
          {...common}
          type={type}
          defaultValue={String(v ?? "")}
          maxLength={type === "text" || type === "email" ? f.max : undefined}
          min={type === "number" ? f.min : undefined}
          max={type === "number" ? f.max : undefined}
          step={type === "number" ? 1 : undefined}
          placeholder={f.placeholder}
          inputMode={type === "number" ? "numeric" : undefined}
          className={`${input} ${f.type === "slug" || f.type === "url" ? "font-mono" : ""} ${f.type === "color" ? "w-20 p-1" : ""}`}
        />
      );
    }
  }
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{f.label}{f.required && <span className="text-copper"> *</span>}</label>
      {control}
      {f.help && <p id={`${id}-help`} className="text-xs text-muted-foreground">{f.help}</p>}
      {err && <p id={`${id}-err`} className="text-xs font-medium text-destructive" role="alert">{err}</p>}
    </div>
  );
}

export function CrudForm(props: { entity: string; id: string; fields: FieldSpec[]; values: Values; media: MediaItem[]; readOnly: boolean; canDelete: boolean; isCreate: boolean }) {
  const { entity, id, fields, values, media, readOnly, canDelete, isCreate } = props;
  const [st, act, pending] = useActionState(saveEntity.bind(null, entity, id), null as CrudState);
  const [, startSave] = useTransition();
  const [del, setDel] = useState<CrudState>(null);
  const [delPending, startDel] = useTransition();
  const sections: { title?: string; fields: FieldSpec[] }[] = [];
  for (const f of fields) {
    const last = sections.at(-1);
    if (!last || (f.section && f.section !== last.title)) sections.push({ title: f.section, fields: [f] });
    else last.fields.push(f);
  }
  return (
    <div className="mt-6">
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.currentTarget);
          startSave(() => act(fd));
        }}
        className="grid gap-6"
        data-testid="crud-form"
        noValidate
      >
        {sections.map((s, i) => (
          <fieldset key={i} className="grid gap-4 rounded-[2px] border border-border bg-card p-4 sm:p-5">
            {s.title && <legend className="label-mono px-1 text-[0.7rem] text-copper">{s.title}</legend>}
            {s.fields.map((f) => <Field key={f.name} f={f} v={values[f.name]} err={st?.errors?.[f.name]} media={media} disabled={readOnly} isCreate={isCreate} />)}
          </fieldset>
        ))}
        {st && !st.ok && <p className="rounded-[2px] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert" data-testid="crud-error">{st.message}</p>}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:opacity-60" disabled={pending} data-testid="crud-save">
              {pending ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}
        {readOnly && <p className="text-sm text-muted-foreground" data-testid="crud-readonly">Lecture seule : vos droits ne permettent pas de modifier ce module.</p>}
      </form>
      {canDelete && (
        <div className="mt-8 border-t border-border pt-4">
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-full border border-destructive/50 px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
            disabled={delPending}
            data-testid="crud-delete"
            onClick={() => {
              if (!window.confirm("Supprimer définitivement cet élément ?")) return;
              startDel(async () => setDel(await deleteEntity(entity, id)));
            }}
          >
            {delPending ? "Suppression…" : "Supprimer"}
          </button>
          {del && !del.ok && <p className="mt-2 text-sm text-destructive" role="alert" data-testid="crud-delete-error">{del.message}</p>}
        </div>
      )}
    </div>
  );
}
