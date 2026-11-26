import type { Metadata } from "next";
import { CartView } from "./cart-view";
import { showPublicPrices } from "@/lib/price-visibility";
import { noindexMeta } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const show = await showPublicPrices();
  return noindexMeta("/panier", show ? "Panier" : "Ma demande de devis", "Votre sélection de produits FAW Aluminium avant l'envoi de la demande de devis.");
}

export default function CartPage() {
  return <CartView />;
}
