import type { Metadata } from "next";
import { QuoteView } from "../../quote-view";

export const metadata: Metadata = { title: "Votre demande de devis", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";

export default async function QuoteConfirmation({ params }: { params: Promise<{ token: string }> }) {
  return <QuoteView token={(await params).token} mode="confirmation" />;
}
