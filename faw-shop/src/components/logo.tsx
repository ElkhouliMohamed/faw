import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo FAW (fichier officiel logo-FAW-transparent-934x267) ; version crème recolorée en mode sombre. */
export function Logo({ className, onDark = false, priority = false, sizes = "200px" }: { className?: string; onDark?: boolean; priority?: boolean; sizes?: string }) {
  return (
    <span className={cn("relative inline-block aspect-[934/267]", className)}>
      {!onDark && (
        <Image src="/brand/logo-faw.png" alt="FAW Aluminium" fill sizes={sizes} priority={priority} className="object-contain dark:hidden" />
      )}
      <Image
        src="/brand/logo-faw-dark.png"
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
