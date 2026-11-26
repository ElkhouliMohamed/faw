"use client";
import { useActionState } from "react";
import { savePermissions } from "@/app/actions/permissions";
import { btnCls } from "../ui";

type Row = { key: string; label: string; manager: string; viewer: string };
const L = { none: "Aucun", read: "Lecture", write: "Écriture" } as const;

export function PermForm({ rows, write }: { rows: Row[]; write: boolean }) {
  const [st, act, pending] = useActionState(savePermissions, null);
  return (
    <form action={act} className="mt-6" data-testid="perm-form">
      <div className="overflow-x-auto rounded-[2px] border border-border bg-card">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="label-mono bg-muted text-[0.65rem] text-muted-foreground">
            <tr><th className="px-3 py-3">Module</th><th className="px-3 py-3">Gestionnaire</th><th className="px-3 py-3">Lecture seule</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-3 py-2">{r.label}</td>
                {(["manager", "viewer"] as const).map((role) => (
                  <td key={role} className="px-3 py-2">
                    <select name={`${role}.${r.key}`} defaultValue={r[role]} disabled={!write} aria-label={`${r.label} – ${role}`} className="h-9 rounded-[2px] border border-input bg-background px-2" data-testid={`perm-${role}-${r.key}`}>
                      {(role === "viewer" ? (["none", "read"] as const) : (["none", "read", "write"] as const)).map((l) => <option key={l} value={l}>{L[l]}</option>)}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {write && (
        <div className="mt-4 flex items-center gap-3">
          <button className={btnCls} disabled={pending} data-testid="perm-save">{pending ? "Enregistrement…" : "Enregistrer"}</button>
          {st && <p className={st.ok ? "text-sm text-emerald-700" : "text-sm text-destructive"} role="status">{st.message}</p>}
        </div>
      )}
    </form>
  );
}
