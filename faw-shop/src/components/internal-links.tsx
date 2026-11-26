import Link from "next/link";
import { FileText } from "lucide-react";

/** Bloc de maillage interne (catégorie, sous-catégorie, produits, formulaire de devis). Groupes vides masqués. */
export function InternalLinks({ groups, quoteHref, quoteLabel, className = "" }: { groups: { title: string; links: { href: string; label: string }[] }[]; quoteHref: string; quoteLabel: string; className?: string }) {
  const shown = groups.filter((g) => g.links.length > 0);
  return (
    <nav aria-label="Liens utiles" className={`hairline pt-10 ${className}`} data-testid="internal-links">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((g) => (
          <div key={g.title}>
            <h2 className="eyebrow text-muted-foreground">{g.title}</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {g.links.map((l) => <li key={l.href}><Link href={l.href} className="font-medium hover:text-copper">{l.label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <Link href={quoteHref} className="btn btn-primary mt-8 px-5"><FileText className="size-4" aria-hidden /> {quoteLabel}</Link>
    </nav>
  );
}
