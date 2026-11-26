import { recordEvent, EVENT_TYPES, type EventType } from "@/lib/events";
import { readJson, sameOrigin } from "@/lib/same-origin";
import { clientIp, rateLimit } from "@/lib/security";

// Événements first-party anonymes (entonnoir). Aucune IP stockée (utilisée seulement pour limiter le débit en mémoire).
export async function POST(req: Request) {
  if (!sameOrigin(req)) return new Response(null, { status: 403 });
  if (!rateLimit(`evt:${await clientIp()}`, 240, 10 * 60_000)) return new Response(null, { status: 429 });
  const b = await readJson(req, 2_000);
  if (!b || !(EVENT_TYPES as readonly string[]).includes(String(b.type))) return new Response(null, { status: 400 });
  // « order » et « quote_request » sont enregistrés côté serveur uniquement.
  if (b.type === "order" || b.type === "quote_request") return new Response(null, { status: 204 });
  await recordEvent({ ...b, type: b.type as EventType, value: undefined }).catch(() => {});
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
