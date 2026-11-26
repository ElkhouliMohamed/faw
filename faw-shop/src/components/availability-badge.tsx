"use client";
import { CheckCircle2, Clock, PackageSearch, XCircle } from "lucide-react";
import { useT } from "./providers";
import type { Availability } from "@/lib/products";
import { cn } from "@/lib/utils";

/** Badge de disponibilité (données du back-office « Stock »). */
export function AvailabilityBadge({ value, compact = false, className }: { value: Availability; compact?: boolean; className?: string }) {
  const { t } = useT();
  const map = {
    "en stock": { label: t.v4.inStock, Icon: CheckCircle2, cls: "text-[#3d6b3a] dark:text-[#9cc497]" },
    "sur commande": { label: t.v4.onOrder, Icon: PackageSearch, cls: "text-copper" },
    "bientôt disponible": { label: t.v4.soon, Icon: Clock, cls: "text-[#8a5a12] dark:text-[#e2b66b]" },
    indisponible: { label: t.v4.unavailable, Icon: XCircle, cls: "text-destructive" },
  }[value];
  return (
    <span data-testid="availability" data-availability={value} className={cn("inline-flex shrink-0 items-center gap-1.5 font-medium", compact ? "text-xs" : "text-sm", map.cls, className)}>
      <map.Icon className={compact ? "size-3" : "size-3.5"} aria-hidden /> {map.label}
    </span>
  );
}
