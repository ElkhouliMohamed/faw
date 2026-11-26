import "server-only";
import { cache } from "react";
import { existsSync } from "node:fs";
import path from "node:path";

export type DocInfo = { href: string; bytes: number | null; preview: string | null; title: string | null; landscape: boolean };

/** Documents connus : titre affiché et format de la vignette (sinon titre générique de la section). */
const KNOWN: Record<string, { title: string; landscape?: boolean }> = {
  "faw-catalogue-portes-coupe-feu": { title: "Catalogue portes coupe-feu (PDF)", landscape: true },
  "faw-portes-coupe-feu-guide-pose-entretien": { title: "Guide technique : pose & entretien" },
};

/** Taille (HEAD sur Laravel) et vignette de 1re page (public/images/docs/<nom>.jpg) d'un PDF publié. */
export const docInfo = cache(async (href: string | null | undefined): Promise<DocInfo | null> => {
  if (!href) return null;
  const origin = process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";
  const res = await fetch(`${origin}${href}`, { method: "HEAD", cache: "no-store", signal: AbortSignal.timeout(2000) }).catch(() => null);
  if (!res?.ok) return null; // fichier absent : on n'affiche pas un lien cassé
  const len = Number(res.headers.get("content-length"));
  const name = path.basename(href, ".pdf");
  const preview = existsSync(path.join(process.cwd(), "public/images/docs", `${name}.jpg`)) ? `/images/docs/${name}.jpg` : null;
  return { href, bytes: Number.isFinite(len) && len > 0 ? len : null, preview, title: KNOWN[name]?.title ?? null, landscape: !!KNOWN[name]?.landscape };
});

export function formatBytes(n: number | null) {
  if (!n) return "";
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} Mo` : `${Math.round(n / 1024)} Ko`;
}

/**
 * Entretien — repris fidèlement du « Guide technique : Pose & entretien, portes battantes coupe-feu » FAW (page 5).
 * Affiché uniquement quand le produit a ce guide PDF attaché.
 */
export const DOOR_MAINTENANCE = {
  frequency: [
    { value: "1 an", label: "ou 35 000 manœuvres" },
    { value: "3 mois", label: "en usage sévère" },
  ],
  checklist: [
    "Lubrifier les charnières et les éléments de verrouillage.",
    "Contrôler le serrage des fixations du ferme-porte et de l’antipanique.",
    "Vérifier et régler le ferme-porte ; contrôler ses composants.",
    "Contrôler la présence et la fixation du joint intumescent ; remplacer tout joint endommagé.",
  ],
  note: "La notice source indique une durée de vie du joint de 10 ans. Un joint abîmé doit être remplacé sans attendre cette échéance.",
};
