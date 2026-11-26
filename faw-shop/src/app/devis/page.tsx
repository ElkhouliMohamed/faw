import type { Metadata } from "next";
import { alternates } from "@/lib/seo";
import { QuoteForm } from "./quote-form";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: { absolute: "Demande de devis en ligne : portes coupe-feu, galandage, incendie | FAW Casablanca" },
    description:
      "Demandez votre devis PDF FAW en ligne, validé par l'équipe : prix HT, TVA 20 % et TTC, valable 14 jours. Portes coupe-feu EI60, châssis galandage, extincteurs, kit portail. Casablanca.",
    alternates: await alternates("/devis"),
  };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function DevisPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const qty = Number(one("qte"));
  return (
    <QuoteForm
      initialRef={one("ref")?.slice(0, 90)}
      initialQty={Number.isInteger(qty) && qty > 0 && qty <= 500 ? qty : 1}
      initialCategory={one("categorie")?.slice(0, 40)}
      fromCart={one("panier") === "1"}
    />
  );
}
