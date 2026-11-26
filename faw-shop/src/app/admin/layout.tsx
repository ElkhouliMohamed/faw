import type { Metadata } from "next";
import { currentAdmin } from "@/lib/admin-auth";
import { visibleModules } from "@/lib/admin/perm";
import { prisma } from "@/lib/db";
import { adminLogout } from "@/app/actions/admin";
import { LoginForm } from "./login-form";
import { AdminNav } from "./admin-nav";

export const metadata: Metadata = { title: "Back-office", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  if (!admin) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-20" dir="ltr" lang="fr">
        <p className="label-mono text-copper">Back-office</p>
        <h1 className="mt-2 text-2xl font-bold">Administration</h1>
        <p className="mt-2 text-sm text-muted-foreground">Accès réservé à l&apos;équipe FAW.</p>
        <LoginForm />
      </div>
    );
  }
  const [mods, pendingQuotes] = await Promise.all([visibleModules(admin), prisma.quote.count({ where: { status: "à valider" } })]);
  const modules = mods.map((m) => ({ key: m.key, label: m.label, href: m.href, group: m.group, keywords: m.keywords }));
  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6 lg:flex lg:gap-8" dir="ltr" lang="fr">
      <AdminNav
        modules={modules}
        pendingQuotes={modules.some((m) => m.key === "devis") ? pendingQuotes : 0}
        logout={
          <form action={adminLogout} className="grid gap-1 px-2">
            <p className="truncate text-xs text-muted-foreground" data-testid="admin-identity">{admin.owner ? "Propriétaire" : admin.name}</p>
            <button className="h-9 rounded-full border border-border px-4 text-sm font-medium hover:bg-muted">Se déconnecter</button>
          </form>
        }
      />
      <div className="min-w-0 flex-1 pb-16 pt-4 lg:pt-2">{children}</div>
    </div>
  );
}
