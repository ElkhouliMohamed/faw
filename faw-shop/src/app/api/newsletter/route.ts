import { z } from "zod";
import { prisma } from "@/lib/db";
import { readJson, sameOrigin } from "@/lib/same-origin";
import { clientIp, rateLimit } from "@/lib/security";

const schema = z.object({
  email: z.string().trim().toLowerCase().max(160).regex(/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/),
  consent: z.literal(true),
  source: z.string().max(60).regex(/^[\w:/-]*$/).optional(),
  website: z.string().max(0).optional(), // pot de miel
});

/** Inscription newsletter depuis un popup : consentement explicite obligatoire, aucune IP stockée. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!rateLimit(`nl:${await clientIp()}`, 8, 10 * 60_000)) return Response.json({ ok: false, error: "rate" }, { status: 429 });
  const v = schema.safeParse(await readJson(req, 2_000));
  if (!v.success) return Response.json({ ok: false, error: "invalid" }, { status: 400 });
  await prisma.newsletterSubscriber.upsert({
    where: { email: v.data.email },
    create: { email: v.data.email, consent: true, source: v.data.source || "popup" },
    update: { consent: true },
  });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
