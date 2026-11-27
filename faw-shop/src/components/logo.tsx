import Image from "next/image";
import { cn } from "@/lib/utils";

const DEFAULT_LIGHT = "/brand/logo-faw.png";
const DEFAULT_DARK = "/brand/logo-faw-dark.png";

/**
 * Logo FAW (fichier officiel logo-FAW-transparent-934x267) ; version crème en mode sombre.
 * `src` / `darkSrc` : logos remplacés dans Filament (Thèmes), affichés dans la même boîte (pas de décalage de mise en page).
 */
export function Logo({
  className,
  onDark = false,
  priority = false,
  sizes = "200px",
  src,
  darkSrc,
}: {
  className?: string;
  onDark?: boolean;
  priority?: boolean;
  sizes?: string;
  src?: string | null;
  darkSrc?: string | null;
}) {
  const light = src || DEFAULT_LIGHT;
  const dark = darkSrc || (src ? src : DEFAULT_DARK);
  return (
    <span className={cn("relative inline-block aspect-[934/267]", className)}>
      {!onDark && (
        <Image src={light} alt="FAW Aluminium" fill sizes={sizes} priority={priority} className="object-contain dark:hidden" />
      )}
      <Image
        src={dark}
        alt={onDark ? "FAW Aluminium" : ""}
        aria-hidden={onDark ? undefined : true}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-contain", !onDark && "hidden dark:block")}
      />
    </span>
  );
}
