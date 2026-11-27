import "server-only";
import { cache } from "react";
import { z } from "zod";
import { publicJson } from "./shop-api";

const nullable = z.string().nullable();
const schema = z.object({
  shop: z.object({ showPrices: z.boolean() }).optional(),
  theme: z.object({ mode: z.enum(["light", "dark"]), accent: z.enum(["copper", "olive", "umber"]) }),
  integrations: z.object({
    gtmEnabled: z.boolean().optional(),
    gtmId: nullable.optional(),
    pixelEnabled: z.boolean(),
    pixelId: nullable,
    gaEnabled: z.boolean(),
    gaId: nullable,
    adsEnabled: z.boolean(),
    adsId: nullable,
    adsLabel: nullable,
    gscVerification: nullable,
  }),
  social: z.object({ floatingEnabled: z.boolean(), channel: z.enum(["whatsapp", "instagram", "linkedin"]), whatsappNumber: nullable, instagram: nullable, linkedin: nullable, facebook: nullable }),
  seo: z.object({ titleTemplate: z.string(), description: nullable, ogImage: nullable, canonicalBase: nullable, noindex: z.boolean(), sitemapEnabled: z.boolean() }),
});
export type PublicConfig = z.infer<typeof schema>;

/** Réglages publics (prix affichés, thème, SEO, intégrations). Cache Next "config", vidé à chaque enregistrement dans Filament. */
export const publicConfig = cache(async function publicConfig(): Promise<PublicConfig | null> {
  const v = schema.safeParse(await publicJson("/api/site-config", "config", 4000));
  return v.success ? v.data : null;
});
