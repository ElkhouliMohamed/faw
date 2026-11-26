"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageSquareText, ShieldCheck, XCircle } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { PORTAL_DICTS } from "@/lib/portal-i18n";
import { acceptQuote, refuseQuote, requestChange, requestOtp, type PortalResult } from "@/app/actions/portal";

type Props = {
  token: string; locale: Locale; versionId: number; number: string; total: string; validUntil: string;
  canAccept: boolean; acceptBlock: string | null; canRefuse: boolean; canRequestChange: boolean; emailMasked: string | null;
};
type Panel = null | "accept" | "change" | "refuse";

/** Décision du client : acceptation en 2 étapes (confirmation + code e-mail), modification, refus. Uniquement des POST. */
export function PortalActions(p: Props) {
  const t = PORTAL_DICTS[p.locale];
  const router = useRouter();
  const [panel, setPanel] = useState<Panel>(null);
  const [checked, setChecked] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const show = (r: PortalResult) => {
    const base = t.codes[r.code] || t.codes.error;
    setMsg({ ok: r.ok, text: r.code === "otp_invalid" && r.remaining != null ? `${base} ${t.remaining(r.remaining)}` : base });
    if (r.ok && r.code !== "otp_sent") {
      setPanel(null);
      router.refresh();
    }
  };
  const open = (next: Panel) => { setPanel(next); setMsg(null); setText(""); setCode(""); setSentTo(null); setChecked(false); };

  return (
    <section className="mt-10 rounded-2xl border border-rule bg-sand p-5 sm:p-6" aria-labelledby="portal-actions" data-testid="portal-actions">
      <h2 id="portal-actions" className="text-lg font-semibold">{t.actionsTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.actionsLead}</p>
      {!p.canAccept && p.acceptBlock && <p className="mt-3 text-sm" data-testid="portal-block">{t.codes[p.acceptBlock] || t.codes.error}</p>}

      {panel === null && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {p.canAccept && <button type="button" className="btn btn-primary" onClick={() => open("accept")} data-testid="portal-accept"><CheckCircle2 className="size-4" aria-hidden /> {t.accept}</button>}
          {p.canRequestChange && <button type="button" className="btn btn-ghost" onClick={() => open("change")} data-testid="portal-change"><MessageSquareText className="size-4" aria-hidden /> {t.change}</button>}
          {p.canRefuse && <button type="button" className="btn btn-ghost" onClick={() => open("refuse")} data-testid="portal-refuse"><XCircle className="size-4" aria-hidden /> {t.refuse}</button>}
        </div>
      )}

      {panel === "accept" && (
        <div className="mt-4 rounded-xl border border-rule bg-background p-4" data-testid="portal-accept-panel">
          <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-copper" aria-hidden /> {t.confirmTitle}</h3>
          <p className="mt-2 text-sm">{t.confirmText(p.number, p.total, p.validUntil)}</p>
          {!sentTo ? (
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await requestOtp(p.token, p.versionId); if (r.ok) setSentTo(r.emailMasked || p.emailMasked || ""); show(r); }); }}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--copper,#b8743a)]" checked={checked} onChange={(e) => setChecked(e.target.checked)} required data-testid="portal-confirm-check" />
                <span>{t.confirmCheck}</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="btn btn-primary" disabled={!checked || pending} data-testid="portal-send-code">{t.sendCode}</button>
                <button type="button" className="btn btn-ghost" onClick={() => open(null)}>{t.cancel}</button>
              </div>
            </form>
          ) : (
            <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); start(async () => show(await acceptQuote(p.token, p.versionId, code, checked))); }}>
              <p className="text-sm text-muted-foreground" data-testid="portal-code-sent">{t.codeSent(sentTo)}</p>
              <label className="block text-sm font-medium" htmlFor="portal-code">{t.codeLabel}</label>
              <input id="portal-code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 w-full max-w-[12rem] rounded-lg border border-rule bg-background px-3 text-center font-mono text-xl tracking-[0.4em]" dir="ltr" data-testid="portal-code" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="submit" className="btn btn-primary" disabled={code.length !== 6 || pending} data-testid="portal-confirm-accept">{t.confirmAccept}</button>
                <button type="button" className="btn btn-ghost" disabled={pending} onClick={() => start(async () => show(await requestOtp(p.token, p.versionId)))}>{t.resend}</button>
                <button type="button" className="btn btn-ghost" onClick={() => open(null)}>{t.cancel}</button>
              </div>
            </form>
          )}
        </div>
      )}

      {(panel === "change" || panel === "refuse") && (
        <form className="mt-4 space-y-3 rounded-xl border border-rule bg-background p-4" data-testid={`portal-${panel}-panel`}
          onSubmit={(e) => { e.preventDefault(); start(async () => show(panel === "change" ? await requestChange(p.token, text) : await refuseQuote(p.token, p.versionId, text))); }}>
          <label className="block text-sm font-medium" htmlFor="portal-text">{panel === "change" ? t.changeLabel : t.refuseLabel}</label>
          <textarea id="portal-text" rows={4} maxLength={panel === "change" ? 2000 : 1000} required={panel === "change"} minLength={panel === "change" ? 5 : undefined} value={text} onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border border-rule bg-background p-3 text-sm" data-testid="portal-text" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="submit" className={panel === "change" ? "btn btn-primary" : "btn btn-ghost border-red-300 text-red-700"} disabled={pending} data-testid="portal-submit">{panel === "change" ? t.changeSend : t.refuseConfirm}</button>
            <button type="button" className="btn btn-ghost" onClick={() => open(null)}>{t.cancel}</button>
          </div>
        </form>
      )}

      {msg && <p role="status" aria-live="polite" className={`mt-3 text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`} data-testid="portal-message">{msg.text}</p>}
    </section>
  );
}
