import "server-only";

/** Lecture du portail client depuis l'API Laravel (127.0.0.1). */
export type PortalLine = { reference: string; name: string; qty: number; unitTtc: number; totalTtc: number };
export type PortalState = {
  quote: { id: number; status: string; ready: boolean; clientName: string; number: string | null; customerDecision: string | null; linkExpiresAt: string | null };
  version: null | {
    id: number; version: number; number: string; issuedAt: string; validUntil: string; expired: boolean; currency: string;
    lines: PortalLine[];
    totals: { subtotal_ttc: number; total_ht: number; tax_rate: number; tax_amount: number; total_ttc: number };
    delivery: { mode: string; city: string | null; amount_ttc: number | null; in_total: boolean; label: string };
    conditions: string[];
  };
  actions: { canAccept: boolean; acceptBlock: string | null; canRefuse: boolean; canRequestChange: boolean; emailMasked: string | null };
  accepted: null | { versionNumber: string; at: string };
  history: { decision: string; versionNumber: string; at: string }[];
  order?: PortalOrder | null;
};
export type PortalOrder = {
  reference: string; status: string; versionNumber: string; totalTtc: number; currency: string;
  fulfilment: "retrait" | "livraison"; pickupAddress: string | null; deliveryCity: string | null; deliveryLabel: string | null;
  createdAt: string | null; history: { status: string; at: string | null }[];
  payment?: PortalPayment;
};
export type PortalPayment = {
  payments: { id: number; label: string; amount: number; currency: string; reference: string; status: string; method: string; proofUploaded: boolean; canUploadProof: boolean }[];
  paid: number; due: number; cardAvailable: false;
  bank: { rib: string | null; iban?: string | null; holder: string | null; bankName: string | null; branch?: string | null; swift: string | null };
  proofRules: { types: string[]; maxBytes: number };
};

export const laravelOrigin = () => process.env.LARAVEL_ORIGIN || "http://127.0.0.1:8000";

export async function getPortal(token: string): Promise<PortalState | null> {
  try {
    const r = await fetch(`${laravelOrigin()}/api/portal/${token}`, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(8000) });
    return r.ok ? ((await r.json()) as PortalState) : null;
  } catch {
    return null;
  }
}
