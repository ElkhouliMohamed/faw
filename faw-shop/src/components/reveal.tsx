import { cn } from "@/lib/utils";

/**
 * Révélation au scroll en CSS seul (opacité + 16 px, scroll-driven animation).
 * Navigateurs sans `animation-timeline` ou « réduire les animations » : contenu affiché tel quel.
 * Aucun JS, aucun contenu masqué avant hydratation.
 */
export function Reveal({ className, children, as: Tag = "div", ...rest }: { className?: string; children: React.ReactNode; as?: "div" | "li" | "section" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("reveal", className)} {...rest}>
      {children}
    </Tag>
  );
}
