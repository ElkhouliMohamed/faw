import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "./checkout-form";
import { showPublicPrices } from "@/lib/price-visibility";
import { siteContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Commande", robots: { index: false, follow: false } };

export default async function CheckoutPage() {
  if (!(await showPublicPrices())) redirect("/panier");
  const { contact } = await siteContent();
  return <CheckoutForm pickupAddress={contact.depotAddress || contact.address} />;
}
