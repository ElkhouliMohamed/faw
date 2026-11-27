// Coordonnées mémorisées dans le navigateur du client (jamais de donnée de paiement), pour pré-remplir la commande suivante.
// Écrites « en attente » à l'envoi, puis validées sur la page de confirmation (commande réellement créée).

export type CheckoutMemory = {
  clientType: "particulier" | "entreprise";
  name: string;
  phone: string;
  email: string;
  company: string;
  ice: string;
  city: string;
  address: string;
  /** Mode de livraison choisi (slug de ville, autre, retrait…). */
  mode: string;
};

const KEY = "faw-checkout-contact-v1";
const PENDING = "faw-checkout-pending-v1";
const FIELDS = ["name", "phone", "email", "company", "ice", "city", "address", "mode"] as const;

function clean(raw: unknown): CheckoutMemory | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out: CheckoutMemory = { clientType: r.clientType === "entreprise" ? "entreprise" : "particulier", name: "", phone: "", email: "", company: "", ice: "", city: "", address: "", mode: "" };
  for (const f of FIELDS) out[f] = typeof r[f] === "string" ? (r[f] as string).slice(0, 300) : "";
  return out.name || out.phone || out.email ? out : null;
}

export function loadCheckoutMemory(): CheckoutMemory | null {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return null;
  }
}

/** À l'envoi du formulaire : rien n'est mémorisé tant que la commande n'est pas confirmée. */
export function stashCheckoutMemory(m: CheckoutMemory) {
  try {
    const v = clean(m);
    if (v) sessionStorage.setItem(PENDING, JSON.stringify(v));
  } catch {}
}

/** Page de confirmation d'une nouvelle commande : les coordonnées envoyées deviennent celles mémorisées. */
export function commitCheckoutMemory() {
  try {
    const v = clean(JSON.parse(sessionStorage.getItem(PENDING) || "null"));
    sessionStorage.removeItem(PENDING);
    if (v) localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

/** « Ce n'est pas vous ? Effacer ». */
export function forgetCheckoutMemory() {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(PENDING);
  } catch {}
}
