"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useConsent, useT } from "./providers";
import { MetaPixel } from "./tracking";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** Bandeau de consentement : rien n'est chargé (GA4, pixel Meta) avant « Accepter ». */
export function ConsentBanner() {
  const { t } = useT();
  const { consent, ready, setConsent } = useConsent();
  const path = usePathname();
  if (!ready || consent !== "unknown" || path.startsWith("/admin")) return null;
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      data-testid="consent-banner"
      className="fixed inset-x-3 bottom-3 z-[45] me-[4.25rem] rounded-lg border border-rule bg-background p-4 shadow-[var(--shadow-warm)] sm:inset-x-auto sm:start-6 sm:bottom-6 sm:me-0 sm:max-w-sm"
    >
      <p id="consent-title" className="text-sm font-semibold">{t.v4.consentTitle}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        {t.v4.consentText} <Link href="/livraison#confidentialite" className="underline underline-offset-2">+</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-primary min-h-11 h-auto flex-1 px-3 text-sm" onClick={() => setConsent("granted")} data-testid="consent-accept">
          {t.v4.consentAccept}
        </button>
        <button type="button" className="btn btn-ghost min-h-11 h-auto flex-1 px-3 text-sm" onClick={() => setConsent("denied")} data-testid="consent-deny">
          {t.v4.consentDeny}
        </button>
      </div>
    </div>
  );
}

/** GA4 injecté par JS (compatible CSP nonce + strict-dynamic), uniquement après consentement. */
function GoogleAnalytics({ id,adsId,adsLabel }: { id?:string;adsId?:string;adsLabel?:string }) {
  const path=usePathname();
  useEffect(()=>{
    const loaderId=id||adsId;if(!loaderId)return;
    window.dataLayer=window.dataLayer||[];
    if(!window.gtag)window.gtag=function gtag(){
      // eslint-disable-next-line prefer-rest-params -- Format Arguments attendu par Google tag.
      window.dataLayer!.push(arguments);
    };
    window.gtag("js",new Date());
    for(const tag of [id,adsId].filter(Boolean))window.gtag("config",tag,{anonymize_ip:true,send_page_view:false});
    const script=document.createElement("script");script.async=true;script.src=`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(loaderId)}`;document.head.appendChild(script);
    return()=>{script.remove();};
  },[id,adsId]);
  useEffect(()=>{if(id)window.gtag?.("event","page_view",{page_path:path,page_location:window.location.origin+path});},[path,id]);
  useEffect(()=>{
    const onAdd=(event:Event)=>{
      if(!id)return;
      const d=((event as CustomEvent<{id?:string;name?:string;value?:number;quantity?:number;price?:number}>).detail)??{};
      const priced=d.value!=null;window.gtag?.("event","add_to_cart",{items:[{item_id:d.id,item_name:d.name,quantity:d.quantity,...(priced?{price:d.price}:{}) }],...(priced?{currency:"MAD",value:d.value}:{})});
    };
    const onLead=(event:Event)=>{
      const d=((event as CustomEvent<{value?:number}>).detail)??{};
      if(id)window.gtag?.("event","generate_lead",d.value!=null?{currency:"MAD",value:d.value}:{});
      if(adsId&&adsLabel)window.gtag?.("event","conversion",{send_to:`${adsId}/${adsLabel}`,page_location:window.location.origin+window.location.pathname});
    };
    window.addEventListener("faw:add-to-cart",onAdd);
    window.addEventListener("faw:lead-recorded",onLead);
    return()=>{window.removeEventListener("faw:add-to-cart",onAdd);window.removeEventListener("faw:lead-recorded",onLead);};
  },[id,adsId,adsLabel]);
  return null;
}
/** Traceurs uniquement après consentement ; jamais sur les liens privés ni les confirmations. */
export function ConsentedTracking({gaId,pixelId,adsId,adsLabel}:{gaId?:string;pixelId?:string;adsId?:string;adsLabel?:string}){
 const {consent}=useConsent();const path=usePathname();
 if(consent!=="granted"||/^\/(?:admin|devis\/(?:suivi|confirmation)|commande\/confirmation)(?:\/|$)/.test(path))return null;
 return <><GoogleAnalytics id={gaId} adsId={adsId} adsLabel={adsLabel}/><MetaPixel pixelId={pixelId}/></>;
}

/** Lien « Gérer les cookies » (pied de page). */
export function ConsentReset({ label }: { label: string }) {
  const { setConsent } = useConsent();
  return (
    <button type="button" className="hover:text-foreground" onClick={() => {
        setConsent("unknown");
        window.location.reload();
      }}>
      {label}
    </button>
  );
}
