"use client";
import { useState, useTransition } from "react";
import { setCartStatus } from "@/app/actions/carts";
import { CART_STATUSES } from "@/lib/carts";

export function CartActions({ id, status, wa, write }: { id: string; status: string; wa: string | null; write: boolean }) {
  const [s, setS] = useState(status);
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const save = (v: string) => start(async () => { const r = await setCartStatus(id, v); setMsg(r.ok ? "" : r.message); if (r.ok) setS(v); });
  return (
    <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-end">
      {wa ? (
        <a href={wa} target="_blank" rel="noopener noreferrer" onClick={() => { if (write && s === "ouvert") save("relancé"); }} className="inline-flex h-9 items-center rounded-full bg-[#1f7a4d] px-4 text-sm font-semibold text-white hover:brightness-110" data-testid="cart-wa">
          Relancer sur WhatsApp
        </a>
      ) : (
        <span className="text-xs text-muted-foreground">Relance impossible (aucun numéro)</span>
      )}
      <select value={s} disabled={!write || pending} onChange={(e) => save(e.target.value)} aria-label="Statut du panier" className="h-9 rounded-[2px] border border-input bg-background px-2 text-sm" data-testid="cart-status">
        {CART_STATUSES.map((x) => <option key={x}>{x}</option>)}
      </select>
      {msg && <p className="text-xs text-destructive" role="alert">{msg}</p>}
    </div>
  );
}
