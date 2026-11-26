import { pageAccess } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { DevisError, casablancaStamp, devisConfig, generateDraft, pdfFirstPagePng, type GeneratorInput } from "@/lib/devis";

export const dynamic = "force-dynamic";

/** Aperçu BROUILLON (admin uniquement) : généré à la volée, sans numéro, jamais stocké. ?format=png pour l'image. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await pageAccess("devis"))) return new Response("Non autorisé", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Introuvable", { status: 404 });
  const q = await prisma.quote.findUnique({ where: { id } });
  const cfg = devisConfig();
  if (!q || !cfg) return new Response("Introuvable", { status: 404 });
  let input: Omit<GeneratorInput, "numero" | "sortie">;
  try {
    input = { ...JSON.parse(q.genInput), date: casablancaStamp().pdf };
  } catch {
    return new Response("Brouillon indisponible", { status: 422 });
  }
  let pdf: Buffer;
  try {
    pdf = await generateDraft(cfg, input);
  } catch (e) {
    return new Response(e instanceof DevisError ? `Brouillon impossible : ${e.message}` : "Brouillon impossible", { status: 422 });
  }
  const common = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow", "X-Content-Type-Options": "nosniff" };
  if (new URL(req.url).searchParams.get("format") === "png") {
    const png = await pdfFirstPagePng(pdf);
    if (!png) return new Response("Aperçu indisponible", { status: 422 });
    return new Response(new Uint8Array(png), { headers: { ...common, "Content-Type": "image/png" } });
  }
  return new Response(new Uint8Array(pdf), { headers: { ...common, "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="BROUILLON-devis-${q.id}.pdf"` } });
}
