"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { waLink } from "@/lib/site";
import { useConsent } from "./providers";

export type PublicPopup = {
  id: number;
  v: string; // version (date de mise à jour) : une modification réaffiche le popup
  kind: "promo" | "newsletter" | "whatsapp";
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  trigger: "delay" | "scroll" | "exit";
  delaySeconds: number;
  scrollPercent: number;
  paths: string[];
  frequency: "once" | "session" | "days";
  frequencyDays: number;
};

// Jamais sur les tunnels de commande / devis ni l'admin.
const EXCLUDED = ["/admin", "/commande", "/devis", "/panier"];
const key = (p: PublicPopup) => `faw-popup-${p.id}-${p.v}`;

/**
 * Plafonnement : « une fois par session » en sessionStorage. « Une seule fois » / « tous les N jours » utilisent
 * localStorage seulement si le visiteur a accepté les cookies ; sinon on retombe sur la session (aucun stockage durable).
 */
function seen(p: PublicPopup, durable: boolean) {
  try {
    if (sessionStorage.getItem(key(p))) return true;
    if (!durable || p.frequency === "session") return false;
    const at = Number(localStorage.getItem(key(p)) || 0);
    if (!at) return false;
    return p.frequency === "once" || Date.now() - at < p.frequencyDays * 86_400_000;
  } catch {
    return true;
  }
}
function markSeen(p: PublicPopup, durable: boolean) {
  try {
    sessionStorage.setItem(key(p), "1");
    if (durable && p.frequency !== "session") localStorage.setItem(key(p), String(Date.now()));
  } catch {}
}

export function Popups({ popups }: { popups: PublicPopup[] }) {
  const path = usePathname();
  const { consent, ready } = useConsent();
  const [open, setOpen] = useState<PublicPopup | null>(null);
  const durable = consent === "granted";

  useEffect(() => {
    setOpen(null);
    // Attendre le choix cookies : le popup ne se superpose jamais au bandeau de consentement.
    if (!ready || consent === "unknown" || !popups.length) return;
    if (EXCLUDED.some((x) => path === x || path.startsWith(x + "/"))) return;
    const p = popups.find((x) => (!x.paths.length || x.paths.some((pre) => path === pre || path.startsWith(pre.endsWith("/") ? pre : pre + "/"))) && !seen(x, durable));
    if (!p) return;
    const show = () => { if (!seen(p, durable)) { markSeen(p, durable); setOpen(p); } };
    if (p.trigger === "delay") {
      const t = setTimeout(show, Math.max(0, p.delaySeconds) * 1000);
      return () => clearTimeout(t);
    }
    if (p.trigger === "scroll") {
      const on = () => {
        const max = document.documentElement.scrollHeight - innerHeight;
        if (max <= 0 || (scrollY / max) * 100 >= p.scrollPercent) { show(); removeEventListener("scroll", on); }
      };
      addEventListener("scroll", on, { passive: true });
      return () => removeEventListener("scroll", on);
    }
    // exit : ordinateur uniquement (pointeur fin) — la souris quitte la fenêtre par le haut.
    if (!matchMedia("(pointer: fine)").matches) return;
    const on = (e: MouseEvent) => { if (e.clientY <= 0 && !e.relatedTarget) show(); };
    document.addEventListener("mouseout", on);
    return () => document.removeEventListener("mouseout", on);
  }, [path, ready, consent, popups, durable]);

  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open]);

  if (!open) return null;
  return <PopupCard p={open} onClose={() => setOpen(null)} />;
}

function PopupCard({ p, onClose }: { p: PublicPopup; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [agree, setAgree] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const href = p.kind === "whatsapp" ? null : p.ctaUrl;
  const wa = p.kind === "whatsapp" ? waLink(`Bonjour, ${p.title}`) : null;
  const link = wa ?? href ?? "";
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return;
    setState("sending");
    try {
      const r = await fetch("/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, consent: true, source: `popup:${p.id}` }) });
      setState(r.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby={`popup-${p.id}-t`} data-testid="popup" data-kind={p.kind}
      className="fixed inset-x-3 bottom-3 z-[46] me-[4.25rem] rounded-lg border border-rule bg-background p-5 shadow-[var(--shadow-warm)] sm:inset-x-auto sm:start-6 sm:bottom-6 sm:me-0 sm:w-[22rem]">
      <button type="button" onClick={onClose} aria-label="Fermer" className="absolute end-2 top-2 inline-flex size-9 items-center justify-center rounded-full hover:bg-sand" data-testid="popup-close">
        <X className="size-4" aria-hidden />
      </button>
      <p id={`popup-${p.id}-t`} className="pe-8 text-base font-semibold">{p.title}</p>
      {p.body && <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{p.body}</p>}
      {p.kind === "newsletter" ? (
        state === "done" ? (
          <p className="mt-3 text-sm font-medium" role="status" data-testid="popup-nl-done">Merci, votre inscription est enregistrée.</p>
        ) : (
          <form onSubmit={submit} className="mt-3 grid gap-2" data-testid="popup-nl-form">
            <label className="sr-only" htmlFor={`nl-${p.id}`}>E-mail</label>
            <input id={`nl-${p.id}`} type="email" required maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="votre@email.ma" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" data-testid="popup-nl-email" />
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" required checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" data-testid="popup-nl-consent" />
              J&apos;accepte de recevoir les actualités FAW Aluminium par e-mail (désinscription sur simple demande).
            </label>
            <button type="submit" disabled={state === "sending" || !agree} className="btn btn-primary h-11 text-sm" data-testid="popup-nl-submit">{p.ctaLabel || "S'inscrire"}</button>
            {state === "error" && <p className="text-xs text-destructive" role="alert">Inscription impossible, réessayez plus tard.</p>}
          </form>
        )
      ) : (
        link && (
          <a href={link} {...(/^https:\/\//.test(link) ? { target: "_blank", rel: "noopener" } : {})} onClick={onClose} className="btn btn-primary mt-3 h-11 w-full text-sm" data-testid="popup-cta">
            {p.ctaLabel || (wa ? "Écrire sur WhatsApp" : "Voir")}
          </a>
        )
      )}
    </div>
  );
}
