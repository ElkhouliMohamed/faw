import { pageAccess } from "@/lib/admin/perm";
import { ManualForm } from "./manual-form";

export const dynamic = "force-dynamic";

export default async function NewContact() {
  if (!(await pageAccess("clients"))) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  return (
    <div className="max-w-3xl">
      <p className="label-mono text-copper">Saisie manuelle</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Nouveau contact / lead</h1>
      <p className="mt-1 text-sm text-muted-foreground">Appel, visite au dépôt, WhatsApp… Si le téléphone existe déjà, la fiche est fusionnée.</p>
      <ManualForm />
    </div>
  );
}
