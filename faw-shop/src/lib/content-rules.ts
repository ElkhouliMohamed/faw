// Mentions interdites sur la boutique (fournisseurs, mentions non autorisées). Partagé par tous les modules éditoriaux.
export const FORBIDDEN: [RegExp, string][] = [
  [/secours/i, "« secours »"],
  [/EI\s*120/i, "EI120"],
  [/normes? europ/i, "« normes européennes »"],
  [/\b(remise|cr[ée]dit|facilit[ée]s? de paiement|paiement par carte|carte bancaire|int[ée]r[êe]ts?)\b/i, "mention commerciale interdite"],
  [/(pose|installation)\s+(offerte|gratuite|incluse)/i, "« pose offerte / incluse »"],
  [/novoferm|alsal|inther|\btesa\b|zodiac|flexidoor|kingber|metalbond|ghazala|nejmet|sirar|\bfaac\b/i, "nom de fournisseur"],
  [/(livr[ée]e?s?|livraison)\s+(en|sous)\s+\d+\s*(h|heures?|jours?)/i, "délai de livraison promis"],
];
export function forbidden(...texts: (string | null | undefined)[]) {
  for (const t of texts) if (t) for (const [re, label] of FORBIDDEN) if (re.test(t)) return label;
  return null;
}
