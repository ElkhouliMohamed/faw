import type { Metadata } from "next";
import { QuoteView } from "../../quote-view";

export const metadata: Metadata = { title: "Suivi de votre devis", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function QuoteSuivi({ params }: { params: Promise<{ token: string }> }) {
  return <QuoteView token={(await params).token} mode="suivi" />;
}
