import {publicConfig} from "@/lib/public-config";
import type { MetadataRoute } from "next";
import { SITE, runtimeEnv } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const config=await publicConfig();
  if (config?.seo.noindex ?? (runtimeEnv("NEXT_PUBLIC_NOINDEX") === "1")) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/panier", "/commande", "/devis/confirmation", "/devis/pdf"] },
    ...(config?.seo.sitemapEnabled !== false ? {sitemap: `${config?.seo.canonicalBase || SITE.url}/sitemap.xml`}:{}),
  };
}
