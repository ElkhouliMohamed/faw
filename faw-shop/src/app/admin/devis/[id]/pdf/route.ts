import { pageAccess } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { pdfResponse } from "@/lib/devis";

export const dynamic = "force-dynamic";

/** PDF définitif (après validation). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await pageAccess("devis"))) return new Response("Non autorisé", { status: 401 });
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return new Response("Introuvable", { status: 404 });
  const q = await prisma.quote.findUnique({ where: { id } });
  if (!q?.pdfFile) return new Response("Introuvable", { status: 404 });
  return pdfResponse(q.pdfFile, new URL(req.url).searchParams.get("dl") === "1");
}
