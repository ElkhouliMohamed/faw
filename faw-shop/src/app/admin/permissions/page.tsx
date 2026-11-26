import { MODULES, PERM_KEYS, ROLE_LABEL, levelFor, permKey } from "@/lib/admin/modules";
import { pageAccess, permMatrix } from "@/lib/admin/perm";
import { PermForm } from "./perm-form";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const acc = await pageAccess("users");
  if (!acc) return <p className="text-sm text-muted-foreground" data-testid="no-access">Accès non autorisé à ce module.</p>;
  const m = await permMatrix();
  const rows = PERM_KEYS.filter((k) => k !== "users").map((k) => ({
    key: k,
    label: MODULES.filter((x) => permKey(x) === k).map((x) => x.label).join(" · "),
    manager: levelFor("manager", k, m),
    viewer: levelFor("viewer", k, m),
  }));
  return (
    <div className="max-w-4xl">
      <p className="label-mono text-copper">Système</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Rôles & permissions</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {ROLE_LABEL.admin} : accès complet (non modifiable). Les utilisateurs, permissions et le journal d&apos;audit restent réservés aux administrateurs. Le mot de passe propriétaire garde l&apos;accès complet.
      </p>
      <PermForm rows={rows} write={acc.write} />
    </div>
  );
}
