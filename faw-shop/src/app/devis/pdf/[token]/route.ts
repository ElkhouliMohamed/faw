import { QUOTE_TOKEN_RE as TOKEN_RE } from "@/lib/devis";
import { shopQuote } from "@/lib/shop-api";

export const dynamic = "force-dynamic";

/**
 * PDF client : uniquement par jeton privé, et seulement une fois le devis validé par l'équipe. Jamais par numéro ni par id.
 * Le fichier est servi par Laravel (/api/quotes/{token}/pdf, mêmes contrôles) ; la boutique ne lit aucun fichier ni aucune base.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  if (!TOKEN_RE.test(token)) return notFound();
  const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
  const r = await fetch(`${origin}/api/quotes/${token}/pdf`, { headers: { Accept: "application/pdf" }, cache: "no-store", signal: AbortSignal.timeout(20000) }).catch(() => null);
  if (!r?.ok || !r.body || !(r.headers.get("content-type") || "").startsWith("application/pdf")) return notFound();
  const download = new URL(req.url).searchParams.get("dl") === "1";
  const match = /filename="?(Devis-\d+-FAW(?:-\d+)?\.pdf)"?/.exec(r.headers.get("content-disposition") || "");
  const num = match ? null : (await shopQuote(token))?.number;
  const file = match?.[1] ?? (num && /^[\w-]{1,20}$/.test(num) ? `Devis-${num}-FAW.pdf` : "devis-faw.pdf");
  return new Response(r.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file}"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
