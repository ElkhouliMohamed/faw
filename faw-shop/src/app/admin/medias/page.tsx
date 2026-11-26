import { pageAccess } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { MediaCard, MediaUpload } from "./media-client";

export const dynamic = "force-dynamic";

export default async function MediasPage() {
  const acc = await pageAccess("media");
  if (!acc) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const items = await prisma.media.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return (
    <div data-testid="media-page">
      <p className="label-mono text-copper">Contenu</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Médiathèque</h1>
      <p className="mt-1 text-sm text-muted-foreground">JPEG, PNG ou WebP, {MAX_UPLOAD_BYTES / 1024 / 1024} Mo maximum par image (6 Mo au total par envoi). Chaque image est vérifiée, ré-encodée en WebP (métadonnées supprimées) et renommée aléatoirement.</p>
      {acc.write && <MediaUpload />}
      <p className="mt-6 text-sm text-muted-foreground" data-testid="media-count">{items.length} image(s)</p>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((m) => (
          <MediaCard key={m.id} m={{ id: m.id, url: m.url, alt: m.alt, width: m.width, height: m.height, size: m.size, originalName: m.originalName }} write={acc.write} />
        ))}
      </ul>
    </div>
  );
}
