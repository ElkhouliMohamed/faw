import "server-only";
import {z} from "zod";
const nullable=z.string().nullable();
const schema=z.object({shop:z.object({showPrices:z.boolean()}).optional(),theme:z.object({mode:z.enum(["light","dark"]),accent:z.enum(["copper","olive","umber"])}),integrations:z.object({pixelEnabled:z.boolean(),pixelId:nullable,gaEnabled:z.boolean(),gaId:nullable,adsEnabled:z.boolean(),adsId:nullable,adsLabel:nullable,gscVerification:nullable}),social:z.object({floatingEnabled:z.boolean(),channel:z.enum(["whatsapp","instagram","linkedin"]),whatsappNumber:nullable,instagram:nullable,linkedin:nullable,facebook:nullable}),seo:z.object({titleTemplate:z.string(),description:nullable,ogImage:nullable,canonicalBase:nullable,noindex:z.boolean(),sitemapEnabled:z.boolean()})});
export type PublicConfig=z.infer<typeof schema>;
export async function publicConfig():Promise<PublicConfig|null>{const r=await fetch(`${process.env.LARAVEL_ORIGIN||"http://127.0.0.1:8000"}/api/site-config`,{cache:"no-store",signal:AbortSignal.timeout(4000)}).catch(()=>null);if(!r?.ok)return null;const v=schema.safeParse(await r.json());return v.success?v.data:null;}
