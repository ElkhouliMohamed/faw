/** 2200 -> "2 200 DH TTC" (espace fine insécable, comme les documents FAW). */
export function formatNumber(n: number) {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f");
}
export function formatDH(n: number, ttc = true) {
  return `${formatNumber(n)}\u00a0DH${ttc ? " TTC" : ""}`;
}

/** Remplace les montants publics (x DH / MAD) par « Prix sur devis ». */
export function stripPriceMentions(text: string | null | undefined): string {
  if (!text) return "";
  const out = text.replace(/(?:prix(?:\s+ttc)?)?\s*[:\-]?\s*\d(?:[\d\s\u00a0\u202f]|\d)*(?:[.,]\d+)?\s*(?:DH|MAD)(?:\s*TTC)?/gi, "Prix sur devis");
  return out.replace(/(?:\s*Prix sur devis){2,}/g, " Prix sur devis").replace(/[ ]{2,}/g, " ").trim();
}

/** Date et heure à Casablanca (pages client). */
export const fmtDateTime = new Intl.DateTimeFormat("fr-MA", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Casablanca" });
