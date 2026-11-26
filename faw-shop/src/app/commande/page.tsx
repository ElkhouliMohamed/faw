import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "./checkout-form";
import { showPublicPrices } from "@/lib/price-visibility";

export const metadata: Metadata = { title: "Demande de commande", robots: { index: false } };

export default async function CheckoutPage() {
  if (!(await showPublicPrices())) redirect("/panier");
  return <CheckoutForm />;
}
