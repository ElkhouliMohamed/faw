// Chemins des fichiers de redirections (instantané lu par le middleware + compteur de visites).
import path from "node:path";

export const redirectsFile = () => path.resolve(process.env.REDIRECTS_FILE?.trim() || path.join(process.cwd(), "data", "redirects.json"));
export const redirectHitsFile = () => path.resolve(process.env.REDIRECT_HITS_FILE?.trim() || path.join(process.cwd(), "data", "redirect-hits.json"));
export type RedirectSnapshot = Record<string, { to: string; code: 301 | 302 }>;
export type RedirectHits = Record<string, { n: number; last: string }>;
