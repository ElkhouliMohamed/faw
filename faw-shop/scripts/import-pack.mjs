// Importe le pack produits FAW (source de vérité) dans le projet.
// - copie les images principales + visuels HD + logo dans /public
// - écrit data/products.json (champs publics uniquement : les "notes" internes ne sont pas publiées)
// Usage : node scripts/import-pack.mjs [chemin-du-pack]
import fs from "node:fs";
import path from "node:path";

const PACK = process.argv[2] || "/workspace/faw-boutique-pack";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = JSON.parse(fs.readFileSync(path.join(PACK, "products.json"), "utf8"));
// Titres SEO réécrits (flux Merchant de Vente Pilot) : H1 + balise title des pages produit.
const FEED = process.env.FEED || "/workspace/vente-pilot/merchant-feed.tsv";
const seoTitles = {};
if (fs.existsSync(FEED)) {
  const [head, ...rows] = fs.readFileSync(FEED, "utf8").split(/\r?\n/).filter(Boolean);
  const cols = head.split("\t");
  const iId = cols.indexOf("id"), iTitle = cols.indexOf("title");
  for (const r of rows) { const c = r.split("\t"); if (c[iId] && c[iTitle]) seoTitles[c[iId]] = c[iTitle].trim(); }
}

// Corrections de rédaction imposées par les règles de marque (aucun prix / produit modifié).
const COPY_FIXES = [
  // Règle maison : le mot « secours » n'apparaît nulle part sur le site.
  ["l'alimentation des engins de secours", "l'alimentation des engins des sapeurs-pompiers"],
];

const out = src.map((p) => {
  let description = p.description;
  for (const [a, b] of COPY_FIXES) description = description.replaceAll(a, b);
  let image = null;
  if (p.image_path) {
    const file = path.basename(p.image_path);
    fs.copyFileSync(p.image_path, path.join(ROOT, "public/images/products", file));
    image = `/images/products/${file}`;
  }
  return {
    id: p.id,
    slug: p.id.toLowerCase(),
    title: p.title,
    seoTitle: seoTitles[p.id] || p.title,
    description,
    price: Number(p.price),
    currency: p.currency,
    availability: p.availability,
    condition: p.condition,
    category: p.category,
    brand: p.brand,
    image,
  };
});

for (const f of fs.readdirSync(path.join(PACK, "images/alt"))) {
  fs.copyFileSync(path.join(PACK, "images/alt", f), path.join(ROOT, "public/images/alt", f));
}
fs.copyFileSync(path.join(PACK, "brand/logo-FAW-transparent-934x267.png"), path.join(ROOT, "public/brand/logo-faw.png"));

fs.writeFileSync(path.join(ROOT, "data/products.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`OK : ${out.length} produits, ${out.filter((p) => !p.image).length} sans image, ${Object.keys(seoTitles).length} titres SEO`);
