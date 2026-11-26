export const CART_STATUSES = ["ouvert", "relancé", "récupéré", "perdu"] as const;
/** Délai après la dernière activité au-delà duquel un panier est considéré abandonné. */
export const ABANDON_MINUTES = 30;
export function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 9 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
