"""Vérifie accueil, boutique, chaque fiche produit, sitemap, /admin/login (local ou public) + JSON-LD et règles éditoriales."""
import json, re, sys, urllib.request
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3100"
H = {"ngrok-skip-browser-warning": "1", "User-Agent": "faw-check-v6"}
def get(p):
    req = urllib.request.Request(BASE + p, headers=H)
    try:
        with urllib.request.urlopen(req, timeout=30) as r: return r.status, r.read().decode("utf8", "replace")
    except urllib.error.HTTPError as e: return e.code, ""
cat = json.load(urllib.request.urlopen("http://127.0.0.1:8000/api/catalog"))
paths = ["/", "/produits", "/sitemap.xml", "/robots.txt", "/admin/login"] + [f"/produits/{p['slug']}" for p in cat]
bad = []; FORBID = [r"portes? de secours", r"EI120", r"normes? europ"]
st, sm = get("/sitemap.xml")
for path in paths:
    st, html = get(path)
    ok = st == 200
    note = ""
    if path.startswith("/produits/"):
        lds = [json.loads(x) for x in re.findall(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S)]
        types = sorted({t for d in lds for t in ([d.get("@type")] if isinstance(d.get("@type"), str) else d.get("@type", []))})
        h1 = len(re.findall(r"<h1[\s>]", html))
        has = lambda t: t in types
        ok = ok and has("Product") and has("BreadcrumbList") and has("Organization") and h1 == 1 and "aggregateRating" not in html and "review" not in json.dumps(lds).lower()
        ok = ok and 'rel="canonical"' in html and "DH TTC" in html and "Pose non comprise" in html or ("Installation non comprise" in html and ok)
        ok = ok and "non contractuelle" in html and f"/produits/{path.split('/')[-1]}</loc>" in sm
        ok = ok and 'id="installation"' in html and 'id="caracteristiques"' in html and 'id="details"' in html
        if any(re.search(f, html, re.I) for f in FORBID): ok = False; note = "mot interdit"
        note += f" ld={','.join(types)} h1={h1}"
    print(("OK  " if ok else "FAIL"), st, path, note)
    if not ok: bad.append(path)
print("pages:", len(paths), "échecs:", len(bad))
sys.exit(1 if bad else 0)
