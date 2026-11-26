import "server-only";
import { headers } from "next/headers";

/** Origine publique de la boutique pour les liens privés de devis (variable d'environnement, sinon en-têtes du proxy). */
export async function publicBaseUrl(): Promise<string> {
  const env = process.env.QUOTE_PUBLIC_BASE_URL?.trim();
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim() || (/^(127\.|localhost)/.test(host) ? "http" : "https");
  if (!/^[\w.-]+(:\d+)?$/.test(host)) return (process.env.NEXT_PUBLIC_SITE_URL || "https://faw.ma").replace(/\/+$/, "");
  return `${proto}://${host}`;
}
export const privateLink = (base: string, token: string) => `${base}/devis/suivi/${token}`;
