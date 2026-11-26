import { findQuoteByToken } from "@/lib/quote-token";

import { QUOTE_TOKEN_RE as TOKEN_RE, pdfResponse } from "@/lib/devis";

export const dynamic = "force-dynamic";

/** PDF client : uniquement par jeton privé, et seulement une fois le devis validé par l'équipe. Jamais par numéro ni par id. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const notFound = () => new Response("Introuvable", { status: 404, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" } });
  if (!TOKEN_RE.test(token)) return notFound();
  const q = await findQuoteByToken(token);
  if (!q || (q.status !== "validé" && q.status !== "envoyé") || !q.pdfFile) return notFound();
  return pdfResponse(q.pdfFile, new URL(req.url).searchParams.get("dl") === "1");
}
