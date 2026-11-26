import { pageAccess } from "@/lib/admin/perm";
import { findContacts, readFilters } from "@/lib/crm-query";
import { csvEscape } from "@/lib/crm";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await pageAccess("clients"))) return new Response("Non autorisé", { status: 401, headers: { "Cache-Control": "no-store" } });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const rows = await findContacts(readFilters(sp));
  const head = ["id", "nom", "telephone", "email", "ville", "type", "societe", "ice", "tags", "source", "utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid", "demandes", "valeur_gagnee_dh_ttc", "cree_le", "derniere_activite"];
  const lines = rows.map((c) =>
    [c.id, c.name, c.phone, c.email, c.city, c.type, c.company, c.ice, c.tagList.join(" | "), c.source, c.utmSource, c.utmMedium, c.utmCampaign, c.gclid, c.fbclid, c.leads, c.ltv, c.createdAt.toISOString(), c.lastActivityAt.toISOString()].map(csvEscape).join(","),
  );
  const body = "\ufeff" + [head.join(","), ...lines].join("\r\n");
  const d = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="faw-contacts-${d}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
