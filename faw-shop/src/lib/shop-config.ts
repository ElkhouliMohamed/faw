// Configuration boutique transmise au client (aucun prix d'achat, aucun fournisseur, aucun secret).
import type { ShippingConfig } from "./delivery";
import type { CategoryKey, PublicProduct } from "./products";

export type PublicCategory = { slug: string; label: string; short: string; family: CategoryKey; image: string | null; href: string };
export type PublicPack = { slug: string; title: string; description: string; image: string | null; price?: number; compareAt?: number; items: { id: string; qty: number; title: string }[]; product: PublicProduct };
export type ShopConfig = { showPrices: boolean; shipping: ShippingConfig; categories: PublicCategory[]; packs: PublicPack[] };
