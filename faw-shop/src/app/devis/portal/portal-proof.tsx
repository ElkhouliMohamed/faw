"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { PORTAL_DICTS } from "@/lib/portal-i18n";
import { uploadProof } from "@/app/actions/portal";

/** Dépôt du justificatif de virement (POST via Server Action). Contrôle final côté serveur. */
export function PortalProof({ token, locale, paymentId, maxBytes }: { token: string; locale: Locale; paymentId: number; maxBytes: number }) {
  const t = PORTAL_DICTS[locale];
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = ref.current?.files?.[0];
    if (!f) return setMsg({ ok: false, text: t.codes.proof_missing });
    if (f.size > maxBytes) return setMsg({ ok: false, text: t.codes.proof_too_large });
    const fd = new FormData();
    fd.append("proof", f);
    start(async () => {
      const r = await uploadProof(token, paymentId, fd);
      setMsg({ ok: r.ok, text: t.codes[r.code] || t.codes.error });
      if (r.ok) router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-2" data-testid={`portal-proof-${paymentId}`}>
      <label className="block text-sm font-medium">{t.proofUpload}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input ref={ref} type="file" name="proof" accept="application/pdf,image/jpeg,image/png" className="min-w-0 flex-1 text-sm file:me-3 file:rounded-full file:border-0 file:bg-sand file:px-3 file:py-1.5" />
        <button type="submit" disabled={pending} className="btn btn-primary">
          <Upload className="size-4" aria-hidden />{t.proofSend}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{t.proofHint}</p>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}
    </form>
  );
}
