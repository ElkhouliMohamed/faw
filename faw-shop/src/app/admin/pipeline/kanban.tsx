"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { updateLeadStatus } from "@/app/actions/crm";
import { LEAD_STATUSES } from "@/lib/crm";
import { formatDH } from "@/lib/format";
import { STATUS_STYLE } from "../ui";
import { cn } from "@/lib/utils";

export type Card = { id: number; number: string; name: string; city: string; company: string | null; total: number; status: string; contactId: number | null; origin: string; items: string };

export function Kanban({ initial }: { initial: Card[] }) {
  const [cards, setCards] = useState(initial);
  const [over, setOver] = useState<string | null>(null);
  const [live, setLive] = useState("");
  const [, start] = useTransition();

  const move = (id: number, status: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card || card.status === status) return;
    const prev = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, status } : c)));
    setLive(`${card.number} déplacée vers « ${status} »`);
    start(async () => {
      const r = await updateLeadStatus(id, status);
      if (!r.ok) {
        setCards(prev);
        setLive("Erreur : statut non enregistré");
      }
    });
  };

  return (
    <>
      <p className="sr-only" aria-live="polite">{live}</p>
      <div className="mt-6 grid auto-cols-[minmax(260px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-6" data-testid="kanban">
        {LEAD_STATUSES.map((s) => {
          const col = cards.filter((c) => c.status === s);
          const sum = col.reduce((a, c) => a + c.total, 0);
          return (
            <section
              key={s}
              aria-label={`Colonne ${s}`}
              data-testid={`col-${s}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setOver(s); }}
              onDragLeave={() => setOver((o) => (o === s ? null : o))}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(Number(e.dataTransfer.getData("text/plain")), s); }}
              className={cn("flex min-h-[60vh] flex-col rounded-[2px] border bg-muted/50 transition", over === s ? "border-copper bg-copper/5" : "border-border")}
            >
              <header className="sticky top-0 border-b border-border p-3">
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[s])}>{s}</span>
                  <span className="text-xs text-muted-foreground" data-testid="col-count">{col.length}</span>
                </div>
                <p className="mt-2 text-lg font-bold tracking-tight" data-testid="col-sum">{formatDH(sum)}</p>
              </header>
              <ul className="flex flex-1 flex-col gap-2 p-2">
                {col.map((c) => (
                  <li
                    key={c.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(c.id)); e.dataTransfer.effectAllowed = "move"; }}
                    data-testid="kanban-card"
                    data-number={c.number}
                    className="cursor-grab rounded-[2px] border border-border bg-card p-3 text-sm shadow-sm active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      {c.contactId ? <Link href={`/admin/clients/${c.contactId}`} className="font-semibold hover:underline">{c.name}</Link> : <span className="font-semibold">{c.name}</span>}
                      <span className="font-semibold whitespace-nowrap">{formatDH(c.total)}</span>
                    </div>
                    <p className="mt-0.5 font-mono text-[0.7rem] text-muted-foreground">{c.number}{c.origin === "manuel" ? " · manuel" : ""}</p>
                    {(c.company || c.city) && <p className="text-xs text-muted-foreground">{[c.company, c.city].filter(Boolean).join(" · ")}</p>}
                    {c.items && <p className="mt-1 line-clamp-2 text-xs">{c.items}</p>}
                    <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      Statut
                      <select
                        value={c.status}
                        onChange={(e) => move(c.id, e.target.value)}
                        aria-label={`Statut de ${c.number}`}
                        data-testid="card-status"
                        className="h-7 flex-1 rounded border border-input bg-background px-1 text-xs text-foreground"
                      >
                        {LEAD_STATUSES.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
