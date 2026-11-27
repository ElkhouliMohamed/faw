// Montants en dirhams (client + serveur). Les prix FAW sont saisis TTC ; le HT est dérivé (TVA 20 %).
// Affichage : « 1 250,00 MAD » (espace fine insécable pour les milliers, virgule décimale).

export const TAX_RATE = 20;
export const CURRENCY = "MAD";

/** HT arrondi au centime à partir d'un montant TTC. */
export function htOf(ttc: number, rate = TAX_RATE): number {
  return Math.round((ttc / (1 + rate / 100)) * 100) / 100;
}

/** TVA contenue dans un montant TTC. */
export function tvaOf(ttc: number, rate = TAX_RATE): number {
  return Math.round((ttc - htOf(ttc, rate)) * 100) / 100;
}

/** 1250 -> « 1 250,00 MAD ». */
export function formatMAD(n: number): string {
  const fixed = (Math.round(n * 100) / 100).toFixed(2);
  const [int, dec] = fixed.split(".");
  const sign = int.startsWith("-") ? "-" : "";
  const digits = sign ? int.slice(1) : int;
  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${dec} ${CURRENCY}`;
}
