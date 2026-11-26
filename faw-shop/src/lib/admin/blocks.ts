// Validation des blocs de contenu (landing pages, accueil, pages techniques).
import { z } from "zod";
import type { Block } from "./crud-types";

export const BLOCKS_HELP = "Blocs disponibles : bandeau, grille de produits, texte, FAQ, appel à l'action.";

const s = (max: number) => z.string().trim().max(max);
const link = s(500).refine((v) => v === "" || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v) || /^https:\/\/wa\.me\//.test(v), "Lien interne (/…) ou https:// uniquement");
const img = s(500).refine((v) => v === "" || /^\/(?!\/)/.test(v), "Image de la médiathèque uniquement");

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("hero"), title: s(120).min(1, "Titre requis"), subtitle: s(300).optional(), ctaLabel: s(40).optional(), ctaUrl: link.optional(), image: img.optional() }),
  z.object({ type: z.literal("products"), title: s(120).optional(), ids: z.array(s(40)).max(24) }),
  z.object({ type: z.literal("text"), title: s(120).optional(), body: s(8000) }),
  z.object({ type: z.literal("faq"), title: s(120).optional(), items: z.array(z.object({ q: s(200).min(1), a: s(1500).min(1) })).max(30) }),
  z.object({ type: z.literal("cta"), title: s(120).min(1, "Titre requis"), text: s(400).optional(), label: s(40).min(1, "Libellé requis"), url: link }),
]);
export const blocksSchema = z.array(blockSchema).max(40);

export function parseBlocks(raw: string | null | undefined): Block[] {
  try {
    const r = blocksSchema.safeParse(JSON.parse(raw || "[]"));
    return r.success ? (r.data as Block[]) : [];
  } catch {
    return [];
  }
}
