import re,json,sys,urllib.request,html
import os
B=os.environ.get("AUDIT_BASE","http://127.0.0.1:3199")
FORB=[r"EI ?120",r"normes? europ",r"\bMHD\b",r"Hörmann|Hormann|Ninz|Novoferm|Teckentrup",r"livr(é|ée|aison) en \d+ ?(h|j|jours|heures)",r"sous \d+ ?(h|jours)",r"(?<!pas de )(?<!ni de )\bcrédit\b",r"MAD|DH\b|dirhams?|\d+[ ,.]?\d* ?(€|MAD)"]
def get(p):
    r=urllib.request.urlopen(urllib.request.Request(B+p,headers={"User-Agent":"audit"}));return r.read().decode()
def meta(h):
    t=re.search(r"<title>(.*?)</title>",h,re.S);c=re.search(r'<link rel="canonical" href="([^"]+)"',h)
    rob=re.search(r'<meta name="robots" content="([^"]+)"',h);alts=re.findall(r'<link rel="alternate" hrefLang="([^"]+)" href="([^"]+)"',h)
    h1=re.findall(r"<h1[^>]*>(.*?)</h1>",h,re.S);d=re.search(r'<meta name="description" content="([^"]*)"',h)
    og=re.search(r'<meta property="og:url" content="([^"]+)"',h)
    return dict(title=html.unescape(t.group(1)) if t else None,canonical=c and c.group(1),robots=rob and rob.group(1),alts=alts,h1=[re.sub("<[^>]+>","",x).strip() for x in h1],desc=d and d.group(1),og=og and og.group(1))
sm=get("/sitemap.xml");locs=re.findall(r"<loc>([^<]+)</loc>",sm)
errs=[];titles={};seen={}
paths=[l.replace(B,"") for l in locs]
if any("zz-test-cachee" in p for p in paths): errs.append("sitemap contient catégorie non publiée")
if not any("zz-test-sous-cat" in p for p in paths): errs.append("sitemap sans sous-catégorie publiée")
for p in paths+[p+("&" if "?" in p else "?")+"lang=ar" for p in paths[:40]]:
    h=get(p);m=meta(h);ar="lang=ar" in p
    exp=B+(p if not p.startswith("?") and p else "/"+p)
    if m["canonical"]!=exp: errs.append(f"{p}: canonical {m['canonical']}")
    if m["og"] and m["og"]!=m["canonical"] and not ar: errs.append(f"{p}: og {m['og']}")
    if len(m["h1"])!=1: errs.append(f"{p}: h1 x{len(m['h1'])}")
    if not m["desc"]: errs.append(f"{p}: no description")
    if m["robots"] and "noindex" in m["robots"] and "nofollow" not in m["robots"] and False: errs.append(f"{p}: noindex in sitemap")
    al=dict(m["alts"])
    if al and (al.get("ar-MA","").split("?")[0]!=al.get("fr-MA","").split("?")[0]): errs.append(f"{p}: hreflang mismatch {al}")
    key=(m["title"],ar)
    if key in titles: errs.append(f"{p}: titre dupliqué avec {titles[key]}")
    titles[key]=p
    for ld in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>',h,re.S):
        if re.search(r'"(Offer|AggregateOffer)"|"price"',ld): errs.append(f"{p}: Offer/price in JSON-LD")
    txt=re.sub(r"<script.*?</script>|<style.*?</style>","",h,flags=re.S);txt=re.sub("<[^>]+>"," ",txt)
    for f in FORB:
        mm=re.search(f,txt,re.I)
        if mm: errs.append(f"{p}: terme interdit «{mm.group(0)}»")
for p,want in [("/panier","noindex"),("/sav","noindex"),("/produits?q=porte","noindex"),("/produits?tri=nom","noindex"),("/produits?dispo=1","noindex"),("/blog","noindex")]:
    m=meta(get(p))
    if not (m["robots"] and want in m["robots"]): errs.append(f"{p}: robots={m['robots']}")
    if p.startswith("/produits") and m["canonical"]!=B+"/produits": errs.append(f"{p}: canonical {m['canonical']}")
    if p in("/panier","/sav") and m["canonical"]!=B+p: errs.append(f"{p}: canonical {m['canonical']}")
for p in ["/contact?lang=ar","/livraison?lang=ar","/?lang=ar"]:
    m=meta(get(p))
    if m["canonical"]!=B+p: errs.append(f"{p}: canonical AR {m['canonical']}")
# nav: sous-cat cachée absente partout
h=get("/produits/portes-coupe-feu")
if "zz-test-cachee" in h: errs.append("catégorie cachée liée")
if "zz-test-sous-cat" not in h: errs.append("sous-catégorie absente de la page parente")
if 'data-testid="internal-links"' not in h: errs.append("pas de maillage interne sur catégorie")
try: get("/produits/zz-test-cachee"); errs.append("catégorie cachée accessible")
except Exception as e: pass
print(len(paths),"URLs sitemap;",len(titles),"pages auditées")
print("\n".join(errs) or "0 erreur")
