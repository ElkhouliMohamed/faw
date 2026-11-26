import { pageAccess } from "@/lib/admin/perm";
import { catalogPdf } from "@/lib/catalog-pdf";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await pageAccess("catalog-pdf"))) return new Response("Non autorisé", { status: 401 });
  const { pdf } = await catalogPdf();
  const day = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Catalogue-FAW-${day}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
