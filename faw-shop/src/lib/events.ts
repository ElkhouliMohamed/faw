import "server-only";
import { prisma } from "./db";

// Mesure d'audience first-party : aucun IP, aucun cookie persistant, sid aléatoire de session.
export const EVENT_TYPES = ["view", "product_view", "add_to_cart", "checkout", "quote_request", "order"] as const;
export type EventType = (typeof EVENT_TYPES)[number];

const clean = (v: unknown, max = 120) => {
  if (typeof v !== "string") return null;
  const s = v.replace(/[\u0000-\u001f<>"]/g, "").trim().slice(0, max);
  return s || null;
};

export async function recordEvent(e: { type: EventType; path?: unknown; productId?: unknown; source?: unknown; medium?: unknown; campaign?: unknown; sid?: unknown; value?: unknown }) {
  if (process.env.FAW_EVENTS === "0") return;
  const path = clean(e.path, 200);
  if (path && path.startsWith("/admin")) return;
  const value = typeof e.value === "number" && Number.isFinite(e.value) ? Math.max(0, Math.min(10_000_000, Math.round(e.value))) : null;
  await prisma.event.create({
    data: {
      type: e.type,
      path,
      productId: clean(e.productId, 90),
      source: clean(e.source, 60)?.toLowerCase() ?? null,
      medium: clean(e.medium, 60)?.toLowerCase() ?? null,
      campaign: clean(e.campaign, 100),
      sid: clean(e.sid, 40),
      value,
    },
  });
}
