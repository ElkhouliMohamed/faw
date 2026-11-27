"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { track } from "./providers";

const ATTR_KEY = "faw-attr-v1";

/** Mesure d'audience first-party (pages vues), sans IP, respecte le refus de consentement. */
export function PageTracker() {
  const path = usePathname();
  useEffect(() => {
    if (!path || path.startsWith("/admin")) return;
    const t = setTimeout(() => track("view"), 300);
    return () => clearTimeout(t);
  }, [path]);
  useEffect(()=>{const onClick=(event:MouseEvent)=>{const target=event.target;if(!(target instanceof Element))return;const href=target.closest("a")?.getAttribute("href")||"";if(/^https:\/\/wa\.me\//.test(href))track("whatsapp_click");};document.addEventListener("click",onClick,{capture:true});return()=>document.removeEventListener("click",onClick,{capture:true});},[]);
  return null;
}

/** Attribution du premier contact (UTM / gclid / fbclid), stockée localement et envoyée avec la demande de commande. */
export function AttributionCapture() {
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const a = {
        utmSource: sp.get("utm_source") ?? undefined,
        utmMedium: sp.get("utm_medium") ?? undefined,
        utmCampaign: sp.get("utm_campaign") ?? undefined,
        gclid: sp.get("gclid") ?? undefined,
        fbclid: sp.get("fbclid") ?? undefined,
      };
      const hasCampaign = Object.values(a).some(Boolean);
      const existing = localStorage.getItem(ATTR_KEY);
      if (!existing || (hasCampaign && !JSON.parse(existing).utmSource && !JSON.parse(existing).gclid && !JSON.parse(existing).fbclid)) {
        let ref: string | undefined;
        try {
          ref = document.referrer && new URL(document.referrer).host !== window.location.host ? document.referrer : undefined;
        } catch {}
        localStorage.setItem(ATTR_KEY, JSON.stringify({ ...a, landing: window.location.pathname + window.location.search, referrer: ref, at: Date.now() }));
      }
    } catch {}
  }, []);
  return null;
}

export function readAttribution(): string {
  try {
    return localStorage.getItem(ATTR_KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

type Fbq = ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown; callMethod?: (...a: unknown[]) => void };
declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function fbTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (params) window.fbq("track", event, params);
    else window.fbq("track", event);
  }
}

export function gaEvent(event: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined") {
    if (typeof window.gtag === "function") {
      window.gtag("event", event, params);
    }
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event, ...params });
  }
}

export type CommerceItem = { id: string; name?: string; value?: number; quantity?: number; price?: number };

export function onCommerceEvent(name: "faw:add-to-cart" | "faw:lead-recorded" | "faw:begin-checkout" | "faw:purchase", handler: (detail: CommerceItem) => void) {
  const listener = (event: Event) => handler(((event as CustomEvent<CommerceItem>).detail) ?? {});
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

/**
 * Meta Pixel : chargé uniquement si un ID est configuré (NEXT_PUBLIC_META_PIXEL_ID, lu au runtime côté serveur).
 * PageView à chaque changement de route, Contact au clic sur un lien WhatsApp ou tel:.
 */
export function MetaPixel({ pixelId }: { pixelId?: string }) {
  const path = usePathname();
  const inited = useRef(false);

  useEffect(() => {
    if (!pixelId || inited.current) return;
    inited.current = true;
    if (!window.fbq) {
      const n: Fbq = function (...args: unknown[]) {
        if (n.callMethod) n.callMethod(...args);
        else n.queue!.push(args);
      } as Fbq;
      n.queue = [];
      n.loaded = true;
      n.version = "2.0";
      n.push = n;
      window.fbq = n;
      window._fbq = n;
    }
    window.fbq!("init", pixelId);
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a");
      const href = a?.getAttribute("href") ?? "";
      if (/^https:\/\/wa\.me\//.test(href) || href.startsWith("tel:")) {
        fbTrack("Contact", { method: href.startsWith("tel:") ? "phone" : "whatsapp" });
      }
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [pixelId]);

  useEffect(() => {
    if (!pixelId) return;
    const stopAdd = onCommerceEvent("faw:add-to-cart", (d) => {
      fbTrack("AddToCart", {
        content_ids: [String(d.id || "").toUpperCase()],
        ...(d.name ? { content_name: d.name } : {}),
        content_type: "product",
        ...(d.value != null ? { value: d.value, currency: "MAD" } : {}),
      });
    });
    const stopLead = onCommerceEvent("faw:lead-recorded", (d) => {
      fbTrack("Lead", d.value != null ? { value: d.value, currency: "MAD", content_name: "Demande de devis" } : { content_name: "Demande de devis" });
    });
    const stopCheckout = onCommerceEvent("faw:begin-checkout", (d) => {
      fbTrack("InitiateCheckout", {
        ...(d.value != null ? { value: d.value, currency: "MAD" } : {}),
        ...(d.quantity != null ? { num_items: d.quantity } : {}),
      });
    });
    const stopPurchase = onCommerceEvent("faw:purchase", (d) => {
      fbTrack("Purchase", {
        ...(d.value != null ? { value: d.value, currency: "MAD" } : {}),
        content_type: "product",
      });
    });
    return () => { stopAdd(); stopLead(); stopCheckout(); stopPurchase(); };
  }, [pixelId]);

  useEffect(() => {
    if (pixelId) fbTrack("PageView");
  }, [pixelId, path]);

  if (!pixelId) return null;
  return <Script id="meta-pixel" src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />;
}

export function ViewContent({ id, name, price }: { id: string; name?: string; price?: number }) {
  useEffect(() => {
    // léger délai : laisse MetaPixel / gtag s'initialiser au premier rendu
    const t = setTimeout(() => {
      const priced = price != null && price > 0;
      fbTrack("ViewContent", {
        content_ids: [id.toUpperCase()],
        ...(name ? { content_name: name } : {}),
        content_type: "product",
        ...(priced ? { value: price, currency: "MAD" } : {}),
      });
      gaEvent("view_item", {
        items: [{ item_id: id, item_name: name, ...(priced ? { price } : {}) }],
        ...(priced ? { currency: "MAD", value: price } : {}),
      });
      track("product_view", { productId: id, ...(priced ? { value: price } : {}) });
    }, 50);
    return () => clearTimeout(t);
  }, [id, name, price]);
  return null;
}

/** Lead une seule fois à l'arrivée sur la confirmation (fbq déjà chargé depuis le formulaire, pas de PageView sur l'URL privée). */
export function QuoteLead({ value, token }: { value?: number; token: string }) {
  useEffect(() => {
    try {
      const key = `faw-lead-${token}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    const t = setTimeout(() => {
      const priced = value != null && value > 0;
      fbTrack("Lead", { content_name: "Demande de devis", ...(priced ? { value, currency: "MAD" } : {}) });
      gaEvent("generate_lead", priced ? { currency: "MAD", value } : {});
      track("quote_request", priced ? { value } : {});
    }, 50);
    return () => clearTimeout(t);
  }, [value, token]);
  return null;
}
