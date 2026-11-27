import { HomeIcon } from "./home/icon";
import { SmartLink } from "./home/ui";
import { cn } from "@/lib/utils";

export type TopBarItem = { icon: string; text: string; url: string };

/**
 * Bandeau brun au-dessus de l'en-tête (Filament : Contenu › En-tête & pied de page).
 * Mobile : premier message seulement ; à partir de 768 px : tous, répartis sur la largeur.
 */
export function TopBar({ items }: { items: TopBarItem[] }) {
  if (!items.length) return null;
  return (
    <div className="bg-bark text-[0.8125rem] text-bark-fg/90" data-testid="top-bar">
      <ul className={cn("shell flex min-h-10 items-center justify-center gap-6 py-2", items.length > 1 && "md:justify-between")}>
        {items.map((item, i) => {
          const content = (
            <>
              <HomeIcon name={item.icon} className="size-4 shrink-0 text-flame" strokeWidth={1.8} />
              <span>{item.text}</span>
            </>
          );
          return (
            <li key={i} className={cn("items-center gap-2", i === 0 ? "flex" : "hidden md:flex")}>
              {item.url ? (
                <SmartLink href={item.url} className="inline-flex items-center gap-2 hover:text-white">{content}</SmartLink>
              ) : (
                content
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
