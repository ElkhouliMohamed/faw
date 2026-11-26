"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { GROUPS, type ModuleDef } from "@/lib/admin/modules";
import { cn } from "@/lib/utils";

export type NavModule = Pick<ModuleDef, "key" | "label" | "href" | "group" | "keywords">;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function isActive(path: string, href: string, all: NavModule[]) {
  if (href === "/admin") return path === "/admin";
  if (!(path === href || path.startsWith(`${href}/`))) return false;
  // Le lien le plus précis gagne (/admin/clients vs /admin/clients/nouveau).
  return !all.some((m) => m.href !== href && m.href.startsWith(`${href}/`) && (path === m.href || path.startsWith(`${m.href}/`)));
}

function Palette({ modules, onClose }: { modules: NavModule[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [i, setI] = useState(0);
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const groupLabel = (g: string) => GROUPS.find((x) => x.key === g)?.label ?? "";
  const res = useMemo(() => {
    const t = norm(q.trim());
    return t ? modules.filter((m) => norm(`${m.label} ${m.keywords ?? ""} ${groupLabel(m.group)}`).includes(t)) : modules;
  }, [q, modules]);
  const go = (m?: NavModule) => {
    if (!m) return;
    onClose();
    router.push(m.href);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onMouseDown={onClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label="Aller à un module" className="w-full max-w-lg overflow-hidden rounded-[4px] border border-border bg-background shadow-xl" onMouseDown={(e) => e.stopPropagation()} data-testid="cmdk">
        <input
          ref={ref}
          value={q}
          onChange={(e) => { setQ(e.target.value); setI(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setI((x) => Math.min(res.length - 1, x + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            else if (e.key === "Enter") { e.preventDefault(); go(res[i]); }
            else if (e.key === "Escape") onClose();
          }}
          placeholder="Rechercher un module…"
          aria-label="Rechercher un module"
          role="combobox"
          aria-expanded="true"
          aria-controls="cmdk-list"
          aria-activedescendant={res[i] ? `cmdk-${res[i].key}` : undefined}
          className="h-12 w-full border-b border-border bg-background px-4 text-sm outline-none"
          data-testid="cmdk-input"
        />
        <ul id="cmdk-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1">
          {res.map((m, k) => (
            <li key={m.key} id={`cmdk-${m.key}`} role="option" aria-selected={k === i}>
              <button type="button" onMouseEnter={() => setI(k)} onClick={() => go(m)} className={cn("flex w-full items-center justify-between gap-3 rounded-[2px] px-3 py-2 text-left text-sm", k === i && "bg-muted")} data-testid="cmdk-item">
                <span>{m.label}</span>
                <span className="label-mono text-[0.6rem] text-muted-foreground">{groupLabel(m.group)}</span>
              </button>
            </li>
          ))}
          {!res.length && <li className="px-3 py-6 text-center text-sm text-muted-foreground">Aucun module</li>}
        </ul>
      </div>
    </div>
  );
}

export function AdminNav({ modules, pendingQuotes = 0, logout }: { modules: NavModule[]; pendingQuotes?: number; logout: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [closed, setClosed] = useState<string[]>([]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((x) => !x);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
  const groups = GROUPS.map((g) => ({ ...g, items: modules.filter((m) => m.group === g.key) })).filter((g) => g.items.length);
  const nav = (
    <nav aria-label="Back-office" className="grid gap-4">
      {groups.map((g) => {
        const shut = closed.includes(g.key) && !g.items.some((m) => isActive(path, m.href, modules));
        return (
          <div key={g.key}>
            <button type="button" onClick={() => setClosed((c) => (c.includes(g.key) ? c.filter((x) => x !== g.key) : [...c, g.key]))} aria-expanded={!shut} className="label-mono flex w-full items-center justify-between px-2 text-[0.62rem] text-muted-foreground hover:text-foreground">
              {g.label}
              <span aria-hidden>{shut ? "+" : "–"}</span>
            </button>
            {!shut && (
              <ul className="mt-1 grid gap-0.5">
                {g.items.map((m) => {
                  const act = isActive(path, m.href, modules);
                  return (
                    <li key={m.key}>
                      <Link href={m.href} aria-current={act ? "page" : undefined} className={cn("flex items-center justify-between rounded-[2px] px-2 py-1.5 text-sm transition", act ? "bg-foreground font-semibold text-background" : "text-foreground/80 hover:bg-muted")} data-testid={`nav-${m.key}`}>
                        <span className="min-w-0 truncate">{m.label}</span>
                        {m.key === "devis" && pendingQuotes > 0 && (
                          <span className="ms-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-black" data-testid="nav-devis-badge" aria-label={`${pendingQuotes} devis à valider`}>
                            {pendingQuotes}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
  const search = (
    <button type="button" onClick={() => setCmd(true)} className="flex h-9 w-full items-center justify-between gap-2 rounded-full border border-border px-3 text-sm text-muted-foreground hover:bg-muted" data-testid="cmdk-open">
      <span>Rechercher…</span>
      <kbd className="label-mono rounded border border-border px-1 text-[0.6rem]">Ctrl K</kbd>
    </button>
  );
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3 lg:hidden">
        <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-controls="admin-drawer" className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-3 text-sm font-medium" data-testid="admin-menu-toggle">
          <span aria-hidden>☰</span> Menu
          {pendingQuotes > 0 && !open && <span className="inline-flex min-w-5 justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-black">{pendingQuotes}</span>}
        </button>
        <div className="w-40">{search}</div>
      </div>
      <aside id="admin-drawer" className={cn("lg:sticky lg:top-4 lg:block lg:max-h-[calc(100vh-2rem)] lg:w-60 lg:shrink-0 lg:overflow-y-auto lg:pe-2", open ? "block py-4" : "hidden")}>
        <div className="mb-4 hidden lg:block">{search}</div>
        {nav}
        <div className="mt-6 border-t border-border pt-4">{logout}</div>
      </aside>
      {cmd && <Palette modules={modules} onClose={() => setCmd(false)} />}
    </>
  );
}
