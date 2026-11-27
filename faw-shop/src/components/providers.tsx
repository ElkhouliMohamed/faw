"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "next-themes";
import { DICTS, type Dict, type Locale } from "@/lib/i18n";
import type { PublicProduct } from "@/lib/products";
import { cartCtx, computeDelivery, DEFAULT_SHIPPING, normalizeMode, type CartItemCtx, type DeliveryMode, type ShippingConfig } from "@/lib/delivery";
import type { ShopConfig } from "@/lib/shop-config";

/* ---------- Locale ---------- */
const LocaleCtx = createContext<{ locale: Locale; t: Dict }>({ locale: "fr", t: DICTS.fr });
export const useT = () => useContext(LocaleCtx);

/* ---------- Cart ---------- */
export type CartLine = { id: string; qty: number };
export type CartRow = { product: PublicProduct; qty: number; lineTotal: number };
type CartState = {
  ready: boolean;
  lines: CartLine[];
  rows: CartRow[];
  count: number;
  subtotal: number;
  mode: DeliveryMode;
  fee: number;
  ctx: ReturnType<typeof cartCtx>;
  notes: ReturnType<typeof computeDelivery>["notes"];
  add: (id: string, qty?: number) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  setMode: (m: DeliveryMode) => void;
  /** Code promo appliqué (revalidé côté serveur à l'envoi). */
  coupon: AppliedCoupon | null;
  discount: number;
  total: number;
  setCoupon: (c: AppliedCoupon | null) => void;
  cartId: string;
};
export type AppliedCoupon = { code: string; kind: "percent" | "fixed"; value: number; minOrder: number };
export function couponDiscount(c: AppliedCoupon | null, subtotal: number) {
  if (!c || subtotal < c.minOrder) return 0;
  return Math.min(subtotal, c.kind === "percent" ? Math.round((subtotal * Math.min(c.value, 90)) / 100) : c.value);
}
const CartCtx = createContext<CartState | null>(null);
export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart outside provider");
  return c;
}

const KEY = "faw-cart-v1";
const MAX_QTY = 999; // au-delà de la limite en ligne d'un produit, le panier propose un devis

/* ---------- Catalogue public (depuis la base, fourni par le layout) ---------- */
const CatalogCtx = createContext<PublicProduct[]>([]);
export const useCatalog = () => useContext(CatalogCtx);
const ShopCtx = createContext<ShopConfig>({ showPrices: false, shipping: { ...DEFAULT_SHIPPING, cities: DEFAULT_SHIPPING.cities.map((c) => ({ ...c, fee: null })) }, categories: [], packs: [] });
/** Configuration boutique éditée au back-office (villes, catégories, packs). */
export const useShop = () => useContext(ShopCtx);

/* ---------- Mesure first-party (anonyme, aucune donnée si refus du consentement) ---------- */
export function track(type: string, data: { productId?: string; value?: number } = {}) {
  try {
    if (localStorage.getItem("faw-consent-v1") === "denied") return;
    let sid = sessionStorage.getItem("faw-sid");
    if (!sid) {
      sid = Math.random().toString(36).slice(2, 12);
      sessionStorage.setItem("faw-sid", sid);
    }
    const a = JSON.parse(localStorage.getItem("faw-attr-v1") || "{}") as Record<string, string | undefined>;
    const body = JSON.stringify({ type, path: location.pathname, sid, source: a.utmSource ?? (a.gclid ? "google" : a.fbclid ? "facebook" : a.referrer ? hostOf(a.referrer) : "direct"), medium: a.utmMedium, campaign: a.utmCampaign, ...data });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/t", new Blob([body], { type: "application/json" }));
    else void fetch("/api/t", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
  } catch {}
}
function hostOf(u: string) {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "referral";
  }
}

/* ---------- Consentement cookies (GA4 / Meta Pixel uniquement après accord) ---------- */
export type Consent = "unknown" | "granted" | "denied";
const CONSENT_KEY = "faw-consent-v1";
const ConsentCtx = createContext<{ consent: Consent; ready: boolean; setConsent: (c: Consent) => void }>({
  consent: "unknown",
  ready: false,
  setConsent: () => {},
});
export const useConsent = () => useContext(ConsentCtx);
function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setC] = useState<Consent>("unknown");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      if (v === "granted" || v === "denied") setC(v);
    } catch {}
    setReady(true);
  }, []);
  const setConsent = useCallback((c: Consent) => {
    setC(c);
    try {
      if (c === "unknown") localStorage.removeItem(CONSENT_KEY);
      else localStorage.setItem(CONSENT_KEY, c);
    } catch {}
  }, []);
  const value = useMemo(() => ({ consent, ready, setConsent }), [consent, ready, setConsent]);
  return <ConsentCtx.Provider value={value}>{children}</ConsentCtx.Provider>;
}

function CartProvider({ catalog: products, shop, children }: { catalog: PublicProduct[]; shop: ShopConfig; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [rawMode, setRawMode] = useState<string>("");
  const [coupon, setCouponState] = useState<AppliedCoupon | null>(null);
  const [cartId, setCartId] = useState("");
  // Les packs se comportent comme des articles du panier (prix du pack, composants pour la livraison).
  const catalog = useMemo(() => [...products, ...shop.packs.map((b) => b.product)], [products, shop.packs]);
  const shipping: ShippingConfig = shop.shipping;

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (Array.isArray(s.lines)) setLines(s.lines.filter((l: CartLine) => catalog.some((p) => p.id === l.id && p.orderable)));
      if (typeof s.mode === "string") setRawMode(s.mode);
      if (s.coupon && typeof s.coupon.code === "string") setCouponState(s.coupon);
      let id = localStorage.getItem("faw-cart-id");
      if (!id || !/^[a-z0-9]{16,40}$/.test(id)) {
        id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
        localStorage.setItem("faw-cart-id", id);
      }
      setCartId(id);
    } catch {}
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      try {
        const s = JSON.parse(e.newValue || "{}");
        setLines(Array.isArray(s.lines) ? s.lines : []);
        setRawMode(s.mode || "");
      } catch {}
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(KEY, JSON.stringify({ lines, mode: rawMode, coupon }));
  }, [lines, rawMode, coupon, ready]);

  // Synchronisation anonyme du panier (paniers abandonnés), sauf refus du consentement.
  useEffect(() => {
    if (!ready || !cartId) return;
    const t = setTimeout(() => {
      try {
        if (localStorage.getItem("faw-consent-v1") === "denied") return;
        if (!lines.length && !localStorage.getItem("faw-cart-synced")) return;
        localStorage.setItem("faw-cart-synced", "1");
        const a = JSON.parse(localStorage.getItem("faw-attr-v1") || "{}") as Record<string, string | undefined>;
        void fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: cartId, items: lines, utmSource: a.utmSource, utmCampaign: a.utmCampaign }), keepalive: true });
      } catch {}
    }, 1500);
    return () => clearTimeout(t);
  }, [lines, ready, cartId]);

  const add = useCallback((id: string, qty = 1) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.id === id);
      if (ex) return ls.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l));
      return [...ls, { id, qty: Math.min(MAX_QTY, qty) }];
    });
    const product = catalog.find((p) => p.id === id);
    const value = shop.showPrices && product?.price ? product.price * qty : undefined;
    track("add_to_cart", { productId: id, value });
    try {
      window.dispatchEvent(new CustomEvent("faw:add-to-cart", { detail: { id, name: product?.title, ...(shop.showPrices && value != null ? { value, price: product?.price } : {}), quantity: qty } }));
    } catch {}
  }, [catalog, shop.showPrices]);
  const setQty = useCallback((id: string, qty: number) => {
    setLines((ls) => (qty <= 0 ? ls.filter((l) => l.id !== id) : ls.map((l) => (l.id === id ? { ...l, qty: Math.min(MAX_QTY, qty) } : l))));
  }, []);
  const remove = useCallback((id: string) => setLines((ls) => ls.filter((l) => l.id !== id)), []);
  const clear = useCallback(() => {
    setLines([]);
    setCouponState(null);
    // Nouveau panier après une commande : l'ancien reste « récupéré » côté serveur.
    try {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem("faw-cart-id", id);
      localStorage.removeItem("faw-cart-synced");
      setCartId(id);
    } catch {}
  }, []);

  const value = useMemo<CartState>(() => {
    const rows = lines
      .map((l) => {
        const product = catalog.find((p) => p.id === l.id);
        return product ? { product, qty: l.qty, lineTotal: (product.price ?? 0) * l.qty } : null;
      })
      .filter((r): r is CartRow => !!r);
    const items: CartItemCtx[] = rows.flatMap((r) => {
      const pack = shop.packs.find((b) => b.product.id === r.product.id);
      if (!pack) return [{ id: r.product.id, cat: r.product.cat, catSlug: r.product.catSlug }];
      return pack.items.map((it) => {
        const p = products.find((x) => x.id === it.id);
        return { id: it.id, cat: p?.cat ?? r.product.cat, catSlug: p?.catSlug };
      });
    });
    const ctx = cartCtx(items);
    const mode = normalizeMode(rawMode, ctx, shipping);
    const { fee, notes } = computeDelivery(mode, ctx, shipping);
    const subtotal = rows.reduce((s, r) => s + r.lineTotal, 0);
    const discount = couponDiscount(coupon, subtotal);
    return {
      ready, lines, rows, ctx, mode, fee, notes, subtotal, coupon, discount, cartId,
      total: subtotal - discount + fee,
      count: rows.reduce((s, r) => s + r.qty, 0),
      add, setQty, remove, clear, setMode: (m) => setRawMode(m), setCoupon: setCouponState,
    };
  }, [lines, rawMode, ready, add, setQty, remove, clear, catalog, coupon, cartId, shipping, shop.packs, products]);

  return <CartCtx.Provider value={value}>{children}</CartCtx.Provider>;
}

/* ---------- jeton anti-spam des formulaires publics ---------- */
const FormTokenCtx = createContext<string>("");
/** Champs cachés anti-robot : jeton signé (temps de remplissage) + champ piège. */
export function FormGuard() {
  const token = useContext(FormTokenCtx);
  return (
    <>
      <input type="hidden" name="formToken" value={token} />
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Site web (laisser vide)
          <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
    </>
  );
}

export function Providers({ locale, catalog, shop, formToken, nonce, defaultTheme="light", children }: { defaultTheme?: "light"|"dark"; locale: Locale; catalog: PublicProduct[]; shop: ShopConfig; formToken: string; nonce?: string; children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem disableTransitionOnChange nonce={nonce}>
      <FormTokenCtx.Provider value={formToken}>
        <LocaleCtx.Provider value={{ locale, t: DICTS[locale] }}>
          <CatalogCtx.Provider value={catalog}>
            <ShopCtx.Provider value={shop}>
              <ConsentProvider>
                <CartProvider catalog={catalog} shop={shop}>{children}</CartProvider>
              </ConsentProvider>
            </ShopCtx.Provider>
          </CatalogCtx.Provider>
        </LocaleCtx.Provider>
      </FormTokenCtx.Provider>
    </ThemeProvider>
  );
}
