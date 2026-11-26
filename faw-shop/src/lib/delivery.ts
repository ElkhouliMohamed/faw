// Logique de livraison / paiement partagée client + serveur (le serveur recalcule toujours).
// Villes, frais et exceptions par produit / catégorie viennent du back-office (Villes de livraison, Assigner frais).
import type { CategoryKey } from "./products";

/** Modes : slug d'une ville de livraison (portes) | autre | livraison | retrait | transporteur. */
export type DeliveryMode = string;
export type PaymentMethod = "virement" | "cheque" | "reception";

export type ShippingCityCfg = { slug: string; name: string; fee: number | null; available: boolean; delayText: string };
export type FeeRuleCfg = { scope: "product" | "category"; target: string; city: string; mode: "fixed" | "devis"; fee: number | null };
export type ShippingConfig = { cities: ShippingCityCfg[]; rules: FeeRuleCfg[] };

/** Valeurs historiques (graine des villes de livraison). */
export const DOOR_FEES = { casablanca: 400, rabat: 800 } as const;
export const DEFAULT_SHIPPING: ShippingConfig = {
  cities: [
    { slug: "casablanca", name: "Casablanca", fee: DOOR_FEES.casablanca, available: true, delayText: "" },
    { slug: "rabat", name: "Rabat", fee: DOOR_FEES.rabat, available: true, delayText: "" },
  ],
  rules: [],
};
export const FIXED_MODES = ["autre", "livraison", "retrait", "transporteur"] as const;

export type CartItemCtx = { id: string; cat: CategoryKey; catSlug?: string };
export type CartCtx = { hasDoors: boolean; hasKit: boolean; hasOther: boolean; kitOnly: boolean; empty: boolean; items: CartItemCtx[] };

export function cartCtx(items: (CategoryKey | CartItemCtx)[]): CartCtx {
  const its: CartItemCtx[] = items.map((x) => (typeof x === "string" ? { id: "", cat: x } : x));
  const cats = its.map((i) => i.cat);
  const hasDoors = cats.includes("portes-coupe-feu");
  const hasKit = cats.includes("automatisme");
  const hasOther = cats.some((c) => c === "galandage" || c === "incendie");
  return { hasDoors, hasKit, hasOther, kitOnly: hasKit && !hasDoors && !hasOther, empty: cats.length === 0, items: its };
}

const cityModes = (cfg: ShippingConfig) => cfg.cities.filter((c) => c.available).map((c) => c.slug);

export function availableModes(ctx: CartCtx, cfg: ShippingConfig = DEFAULT_SHIPPING): DeliveryMode[] {
  if (ctx.empty) return [];
  if (ctx.hasDoors) return [...cityModes(cfg), "autre", "retrait"];
  if (ctx.kitOnly) return ["transporteur"];
  return [...cityModes(cfg), "livraison", "retrait"];
}
export function defaultMode(ctx: CartCtx, cfg: ShippingConfig = DEFAULT_SHIPPING): DeliveryMode {
  return availableModes(ctx, cfg)[0] ?? "retrait";
}
export function normalizeMode(mode: string | undefined, ctx: CartCtx, cfg: ShippingConfig = DEFAULT_SHIPPING): DeliveryMode {
  const modes = availableModes(ctx, cfg);
  return modes.includes(mode ?? "") ? (mode as DeliveryMode) : defaultMode(ctx, cfg);
}
export const cityOf = (mode: string, cfg: ShippingConfig = DEFAULT_SHIPPING) => cfg.cities.find((c) => c.slug === mode) ?? null;

/** Note keys, translated in the UI (see i18n `deliveryNotes`). */
export type DeliveryNoteKey = "autreDevis" | "otherToConfirm" | "kitCarrier" | "pickupAddress" | "once" | "noInstall" | "cityDevis";

/** Règle applicable à une ligne pour une ville : produit d'abord, puis catégorie ; ville précise avant « toutes villes ». */
export function ruleFor(item: CartItemCtx, city: string, cfg: ShippingConfig): FeeRuleCfg | null {
  const match = (r: FeeRuleCfg) => r.city === city || r.city === "";
  const pick = (rs: FeeRuleCfg[]) => rs.find((r) => r.city === city) ?? rs.find((r) => r.city === "") ?? null;
  const prod = cfg.rules.filter((r) => r.scope === "product" && r.target === item.id && match(r));
  if (prod.length) return pick(prod);
  const cat = cfg.rules.filter((r) => r.scope === "category" && !!item.catSlug && r.target === item.catSlug && match(r));
  return cat.length ? pick(cat) : null;
}

export function computeDelivery(mode: DeliveryMode, ctx: CartCtx, cfg: ShippingConfig = DEFAULT_SHIPPING): { fee: number; notes: DeliveryNoteKey[] } {
  const notes: DeliveryNoteKey[] = [];
  let fee = 0;
  let devis = false;
  const city = cityOf(mode, cfg);
  if (mode !== "retrait") {
    // Frais une seule fois par demande : le plus élevé des frais applicables aux lignes.
    for (const it of ctx.items.length ? ctx.items : [{ id: "", cat: "portes-coupe-feu" as CategoryKey }]) {
      const r = ruleFor(it, city?.slug ?? "", cfg);
      if (r) {
        if (r.mode === "devis") devis = true;
        else fee = Math.max(fee, r.fee ?? 0);
      } else if (city && it.cat === "portes-coupe-feu") {
        if (city.fee == null) devis = true;
        else fee = Math.max(fee, city.fee);
      }
    }
    if (devis) notes.push("cityDevis");
    if (fee > 0) notes.push("once");
  }
  if (ctx.hasDoors && mode === "autre") notes.push("autreDevis");
  if (ctx.hasOther && mode !== "retrait") notes.push("otherToConfirm");
  if (ctx.hasKit) notes.push("kitCarrier");
  if (mode === "retrait") notes.push("pickupAddress");
  notes.push("noInstall");
  return { fee, notes };
}

export function allowedPayments(ctx: CartCtx): PaymentMethod[] {
  return ctx.kitOnly ? ["virement", "cheque", "reception"] : ["virement", "cheque"];
}

const FIXED_LABEL: Record<string, string> = {
  casablanca: "Livraison Casablanca (sur devis)",
  rabat: "Livraison Rabat (sur devis)",
  autre: "Autre ville (sur devis)",
  livraison: "Livraison (sur devis)",
  retrait: "Retrait gratuit au dépôt",
  transporteur: "Transporteur, frais à confirmer à la réception",
};
/** Libellé FR d'un mode (villes configurées : nom + frais). */
export function frDeliveryLabel(mode: string, cfg: ShippingConfig = DEFAULT_SHIPPING, fee?: number) {
  const c = cityOf(mode, cfg);
  if (c) return `Livraison ${c.name} (${fee != null && fee > 0 ? `${fee} DH` : c.fee == null ? "sur devis" : `${c.fee} DH`})`;
  return FIXED_LABEL[mode] ?? mode;
}
/** Compatibilité : libellés historiques (commandes déjà enregistrées). */
export const FR_DELIVERY_LABEL = FIXED_LABEL as Record<DeliveryMode, string>;
export const FR_PAYMENT_LABEL: Record<PaymentMethod, string> = {
  virement: "Virement bancaire",
  cheque: "Chèque",
  reception: "Paiement à la réception",
};
