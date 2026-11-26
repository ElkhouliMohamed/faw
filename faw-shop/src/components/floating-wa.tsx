"use client";
import type {PublicConfig} from "@/lib/public-config";
import { usePathname } from "next/navigation";
import { WhatsAppIcon,SocialIcon } from "./icons";
import { useT } from "./providers";
import { waLink } from "@/lib/site";
import { cn } from "@/lib/utils";

/** Bouton WhatsApp discret (brun chaud / crème), masqué sur mobile en fiche produit (barre d'achat collante). */
export function FloatingWhatsApp({config}:{config?:PublicConfig["social"]}) {
  const path = usePathname();
  const { t } = useT();
  if(config?.floatingEnabled===false)return null;
  const channel=config?.channel || "whatsapp";
  const link=channel==="whatsapp"?(config?.whatsappNumber?`https://wa.me/${config.whatsappNumber}`:waLink("Bonjour FAW")):config?.[channel];
  if(!link)return null;
  if (path.startsWith("/admin") || path.startsWith("/commande")) return null;
  const product = /^\/produits\/[^/]+/.test(path);
  return (
    <a
      href={link}
      target="_blank"
      rel="noopener"
      aria-label={channel==="whatsapp"?t.home.ctaWa:channel==="instagram"?"Instagram FAW":"LinkedIn FAW"}
      className={cn(
        "fixed end-4 bottom-4 z-40 grid size-12 place-items-center rounded-full bg-foreground text-background shadow-[var(--shadow-warm)] transition-transform hover:-translate-y-0.5 sm:end-6 sm:bottom-6",
        product && "max-lg:hidden",
      )}
    >
      {channel==="whatsapp"?<WhatsAppIcon className="size-5" />:<SocialIcon k={channel} className="size-5"/>}
    </a>
  );
}
