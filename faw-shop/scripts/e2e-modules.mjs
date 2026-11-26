// E2E modules back-office (phases 1–2) : CRUD générique + effet vitrine, droits, fuites avant connexion, upload, PDF, débordement.
// Usage : ./scripts/start-test-server.sh && BASE=http://127.0.0.1:3200 node scripts/e2e-modules.mjs
// Uniquement sur la base de TEST (/tmp/faw-devis-test/faw-test.db) ; les données de test sont désactivées en fin de run.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import sharp from "sharp";

const BASE = process.env.BASE || "http://127.0.0.1:3200";
if (!/127\.0\.0\.1:3200|localhost:3200/.test(BASE)) throw new Error("e2e-modules : serveur de test :3200 uniquement");
const ROOT = new URL("../", import.meta.url).pathname;
const OUT = ROOT + "shots/v4/admin-modules/";
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);
const TESTDB = "/tmp/faw-devis-test/faw-test.db";
const db = (sql) => JSON.parse(execFileSync("python3", ["-c", "import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);r=c.execute(sys.argv[2]).fetchall();c.commit();print(json.dumps(r))", TESTDB, sql], { encoding: "utf8" }));
const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + String(extra).slice(0, 300) : ""}`);
};
const FORBIDDEN = /secours|\bEI\s?120\b|normes? europ|(pose|installation)\s+(offerte|gratuite|incluse)|\bremise\b|cr[ée]dit|mensualit|carte bancaire|prix d'achat|fournisseur|fabricant/i;
const norm = (s) => String(s ?? "").replace(/[\s\u00a0\u202f]+/g, " ").trim();
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const consoleErrors = [];

const browser = await chromium.launch();
async function newPage(opts = {}, consent = "denied") {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  if (consent) await ctx.addInitScript((c) => { try { if (!localStorage.getItem("faw-consent-v1")) localStorage.setItem("faw-consent-v1", c); } catch {} }, consent);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && consoleErrors.push(`${page.url()} :: ${m.text()}`));
  return page;
}
async function login(page, email, password) {
  await page.goto(BASE + "/admin");
  if (email) await page.fill("#email", email);
  await page.fill("#password", password);
  await page.getByRole("button", { name: /connexion|se connecter|entrer/i }).click();
  await page.waitForLoadState("networkidle");
}
/** Remplit le formulaire CRUD générique et enregistre ; renvoie l'id (URL /admin/m/<entity>/<id>?saved=1). */
async function save(page, entity, fields, id = "nouveau") {
  await page.goto(`${BASE}/admin/m/${entity}/${id}`);
  await page.getByTestId("crud-form").waitFor();
  for (const [name, v] of Object.entries(fields)) {
    if (Array.isArray(v)) {
      for (const x of v) await page.getByTestId(`multi-${name}`).locator(`input[type=checkbox][data-value="${x}"]`).check();
      continue;
    }
    const el = page.locator(`#f-${name}`);
    const tag = await el.evaluate((n) => (n.tagName === "INPUT" ? n.type : n.tagName.toLowerCase()));
    if (tag === "checkbox") await el.setChecked(!!v);
    else if (tag === "select") await el.selectOption(String(v));
    else await el.fill(String(v));
  }
  await page.getByTestId("crud-save").click();
  try {
    await page.waitForURL(new RegExp(`/admin/m/${entity}/[^/?]+\\?saved=1`), { timeout: 15_000 });
  } catch {
    const err = norm(await page.locator("[role=alert]").allTextContents().then((a) => a.join(" | ")).catch(() => ""));
    return { id: null, err };
  }
  return { id: decodeURIComponent(page.url().split("/").pop().split("?")[0]) };
}
const shot = async (page, name, full = false) => page.screenshot({ path: OUT + name + ".png", fullPage: full });

/* ---------- 1. Aucune fuite avant connexion ---------- */
{
  const routes = ["/admin/m/products", "/admin/m/users", "/admin/m/coupons/nouveau", "/admin/m/audit", "/admin/analytics", "/admin/paniers", "/admin/medias", "/admin/permissions", "/admin/catalogue-pdf"];
  for (const r of routes) {
    const res = await fetch(BASE + r, { redirect: "manual" });
    const html = res.status === 200 ? await res.text() : "";
    const leak = /data-testid="(entity-table|kpi-|carts-list|media-item|crud-form|funnel|catalog-pdf-page|dash-7d)/.test(html) || /passwordHash|entity-count|purchasePrice|"failedCount"/.test(html);
    ok(`anonyme ${r} : aucune donnée (formulaire de connexion)`, !leak && (res.status !== 200 || html.includes('id="password"')), `HTTP ${res.status}`);
  }
  const pdf = await fetch(BASE + "/admin/catalogue-pdf/telecharger");
  ok("anonyme : téléchargement catalogue PDF → 401", pdf.status === 401, `HTTP ${pdf.status}`);
  const nl = await fetch(BASE + "/api/newsletter", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "x@y.ma", consent: true }) });
  ok("newsletter : requête sans Origin refusée (403)", nl.status === 403, `HTTP ${nl.status}`);
  const nl2 = await fetch(BASE + "/api/newsletter", { method: "POST", headers: { "content-type": "application/json", origin: BASE }, body: JSON.stringify({ email: "x@y.ma", consent: false }) });
  ok("newsletter : consentement absent refusé (400)", nl2.status === 400, `HTTP ${nl2.status}`);
}

/* ---------- 2. Connexion propriétaire + navigation ---------- */
const admin = await newPage();
await login(admin, null, env.ADMIN_PASSWORD);
ok("connexion propriétaire (ADMIN_PASSWORD)", (await admin.getByTestId("dash-7d").count()) === 1);
await shot(admin, "01-dashboard-1440", true);
{
  const groups = await admin.locator("nav [data-testid^=nav-]").count();
  ok("barre latérale groupée : ≥ 20 modules", groups >= 20, `${groups} liens`);
  await admin.keyboard.press("Control+k");
  await admin.getByTestId("cmdk").waitFor({ timeout: 5000 });
  await admin.getByTestId("cmdk-input").fill("coupons");
  await shot(admin, "02-cmdk");
  await admin.keyboard.press("Enter");
  await admin.waitForURL(/\/admin\/m\/coupons/, { timeout: 10_000 }).catch(() => {});
  ok("Ctrl+K : palette → Coupons", /\/admin\/m\/coupons/.test(admin.url()), admin.url());
}

/* ---------- 3. Catégorie : créer, modifier, supprimer (vide) ---------- */
{
  const r = await save(admin, "categories", { label: `Catégorie E2E ${rnd}`, slug: `cat-e2e-${rnd}`, short: "E2E", family: "portes-coupe-feu", sortOrder: 90, active: false, seoTitle: `Catégorie E2E ${rnd}`, seoDescription: "Description SEO de test." });
  ok("catégorie : création", r.id, r.err);
  if (r.id) {
    const r2 = await save(admin, "categories", { label: `Catégorie E2E ${rnd} modifiée` }, r.id);
    ok("catégorie : modification", r2.id && db(`select label from Category where id=${Number(r.id)}`)[0]?.[0].endsWith("modifiée"));
    admin.once("dialog", (d) => d.accept());
    await admin.getByTestId("crud-delete").click();
    await admin.waitForURL(/deleted=1/, { timeout: 10_000 }).catch(() => {});
    ok("catégorie vide : suppression", db(`select count(*) from Category where id=${Number(r.id)}`)[0][0] === 0);
  }
  const bad = await save(admin, "categories", { label: "<script>x</script>", slug: "Pas Un Slug" });
  ok("catégorie : validation zod (slug invalide refusé)", !bad.id, bad.err);
}

/* ---------- 4. Produit + promotion + garantie + badge ---------- */
const PID = `E2E-${rnd}`;
const PSLUG = `produit-e2e-${rnd}`;
{
  const r = await save(admin, "products", { id: PID, title: `Produit test E2E ${rnd}`, slug: PSLUG, category: "Portes coupe-feu", price: 1234, availability: "en stock", active: true, description: "Produit de test automatisé, désactivé en fin de test.", seoTitle: `Produit test E2E ${rnd}`, metaDescription: "Meta de test." });
  ok("produit : création (champs SEO compris)", r.id === PID, r.err);
  await shot(admin, "03-produit-edition-1440", true);
  let html = await (await fetch(`${BASE}/produits/${PSLUG}`)).text();
  ok("produit : visible sur la boutique", html.includes(`Produit test E2E ${rnd}`) && /<meta name="description" content="Meta de test\."/.test(html));

  const w = await save(admin, "warranties", { name: `Garantie E2E ${rnd}`, text: `Texte de garantie E2E ${rnd}`, active: true, _products: [PID] });
  ok("garantie : création ciblée produit", w.id, w.err);
  const b = await save(admin, "badges", { label: `Badge${rnd}`, active: true, _products: [PID] });
  ok("badge : création", b.id, b.err);
  const p = await save(admin, "promotions", { name: `Promo E2E ${rnd}`, kind: "percent", value: 10, scope: "product", _products: [PID], active: true });
  ok("promotion : création", p.id, p.err);
  ok("promotion : l'admin signale « changement de prix, jamais remise »", /prix|barr/i.test(norm(await admin.locator("body").textContent())));

  const page = await newPage();
  await page.goto(`${BASE}/produits/${PSLUG}`);
  const priceEl = page.locator("main").getByTestId("price").first();
  const was = norm(await priceEl.getByTestId("price-was").textContent().catch(() => ""));
  const active = norm(await priceEl.textContent().catch(() => "")).replace(was, "");
  ok("promotion : ancien prix barré + prix actif", /1 234/.test(was) && /1 111|1 110/.test(active), `${was} → ${active}`);
  // La FAQ de refus (« Pas de paiement par carte, ni de crédit ») est autorisée : on la retire avant le contrôle.
  const mainTxt = norm(await page.locator("main").textContent()).replace(/Pas de paiement par carte, ni de cr[ée]dit\.?/gi, "");
  ok("promotion : aucun mot interdit sur la fiche", !FORBIDDEN.test(mainTxt), mainTxt.match(FORBIDDEN)?.[0]);
  ok("garantie affichée sur la fiche", norm(await page.getByTestId("warranty").textContent().catch(() => "")).includes(`Texte de garantie E2E ${rnd}`));
  ok("badge affiché sur la fiche", norm(await page.getByTestId("badges").textContent().catch(() => "")).includes(`Badge${rnd}`));
  await shot(page, "04-fiche-promo-garantie-1440");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  ok("fiche produit 390 px : pas de débordement", (await overflowX(page)) <= 0);
  await shot(page, "05-fiche-promo-390");

  /* ---------- 5. Coupon dans le panier ---------- */
  const c = await save(admin, "coupons", { code: `E2E${rnd}`, kind: "percent", value: 5, minOrder: 0, active: true });
  ok("coupon : création", c.id, c.err);
  await page.setViewportSize({ width: 1440, height: 900 });
  const cartsDenied = db("select count(*) from Cart")[0][0];
  await page.goto(`${BASE}/produits/${PSLUG}`);
  await page.getByTestId("add-to-cart").click();
  await sleep(600);
  await page.goto(`${BASE}/panier`);
  await page.getByTestId("coupon-input").fill(`e2e${rnd}`);
  await page.getByTestId("coupon-apply").click();
  await page.getByTestId("coupon-applied").waitFor({ timeout: 8000 }).catch(() => {});
  const line = norm(await page.getByTestId("coupon-line").textContent().catch(() => ""));
  ok("coupon : appliqué au panier (ligne coupon)", (await page.getByTestId("coupon-applied").count()) === 1 && /E2E/i.test(line + (await page.getByTestId("coupon-applied").textContent().catch(() => ""))), line);
  ok("coupon : pas le mot « remise »", !/\bremise\b/i.test(norm(await page.locator("main").textContent())));
  await page.getByTestId("coupon-input").count().then(async (n) => {
    if (!n) return;
  });
  await shot(page, "06-panier-coupon-1440");
  const bad = await (await page.context().request.post(`${BASE}/api/cart`, { headers: { origin: BASE }, data: {} }).catch(() => null))?.status();
  ok("api/cart : corps invalide refusé", bad === 400 || bad === 403 || bad === 422, `HTTP ${bad}`);
  await page.close();
  ok("panier : aucune synchronisation si consentement refusé", db("select count(*) from Cart")[0][0] === cartsDenied);
  const before = db("select count(*) from Cart")[0][0];
  const g = await newPage({}, "granted");
  await g.goto(`${BASE}/produits/${PSLUG}`);
  await g.getByTestId("add-to-cart").click();
  await sleep(3000);
  ok("panier : synchronisé (consentement accepté) pour les paniers abandonnés", db("select count(*) from Cart")[0][0] > before);
  await g.context().close();

  /* ---------- 6. Pack ---------- */
  const k = await save(admin, "bundles", { title: `Pack E2E ${rnd}`, slug: `pack-e2e-${rnd}`, description: "Pack de test.", items: `1 x ${PID}\n1 x CF-EI60-80`, price: 3000, active: true });
  ok("pack : création", k.id, k.err);
  html = await (await fetch(`${BASE}/packs`)).text();
  ok("pack : affiché sur /packs avec son prix", html.includes(`Pack E2E ${rnd}`) && /3[\s\u00a0\u202f]000/.test(html));
}

/* ---------- 7. Redirections SEO + import CSV + compteur ---------- */
{
  const r = await save(admin, "redirects", { from: `/ancien-e2e-${rnd}`, to: "/produits", code: "301", active: true });
  ok("redirection : création", r.id, r.err);
  await sleep(2500); // le middleware relit l'instantané au plus toutes les 2 s
  let res = await fetch(`${BASE}/ancien-e2e-${rnd}`, { redirect: "manual" });
  ok("redirection 301 active", res.status === 301 && /\/produits$/.test(res.headers.get("location") ?? ""), `${res.status} ${res.headers.get("location")}`);
  await admin.goto(`${BASE}/admin/m/redirects`);
  await admin.getByTestId("redirect-import").locator("summary").click();
  await admin.getByTestId("redirect-csv").fill(`source,destination,code\n/csv-e2e-${rnd},/contact,302\n/csv-bad-${rnd},javascript:alert(1),301`);
  await admin.getByTestId("redirect-import-submit").click();
  await admin.getByTestId("redirect-import-error").waitFor({ timeout: 10_000 }).catch(() => {});
  ok("import CSV : ligne dangereuse → import annulé en entier", (await admin.getByTestId("redirect-import-error").count()) === 1 && db(`select count(*) from Redirect where "from"='/csv-e2e-${rnd}'`)[0][0] === 0, norm(await admin.getByTestId("redirect-import-error").textContent().catch(() => "")));
  await admin.getByTestId("redirect-csv").fill(`source,destination,code\n/csv-e2e-${rnd},/contact,302`);
  await admin.getByTestId("redirect-import-submit").click();
  await admin.getByTestId("import-result").first().waitFor({ timeout: 10_000 }).catch(() => {});
  ok("import CSV : résultat affiché", (await admin.getByTestId("import-result").count()) >= 1, norm(await admin.getByTestId("import-result").textContent().catch(() => admin.url())));
  await sleep(2500);
  res = await fetch(`${BASE}/csv-e2e-${rnd}`, { redirect: "manual" });
  ok("import CSV : 302 active", res.status === 302 && /\/contact$/.test(res.headers.get("location") ?? ""), `${res.status}`);
  res = await fetch(`${BASE}/csv-bad-${rnd}`, { redirect: "manual" });
  ok("import CSV : destination javascript: rejetée", res.status !== 301 && res.status !== 302, `${res.status}`);
  await sleep(3500); // compteur écrit par lots toutes les 3 s
  await admin.goto(`${BASE}/admin/m/redirects`);
  const n = Number(await admin.locator("tr", { hasText: `/ancien-e2e-${rnd}` }).getByTestId("redirect-hits").textContent().catch(() => "0"));
  ok("redirection : compteur de visites ≥ 1", n >= 1, `${n} visite(s)`);
  await shot(admin, "07-redirections-1440", true);
}

/* ---------- 8. Landing page ---------- */
{
  await admin.goto(`${BASE}/admin/m/landings/nouveau`);
  await admin.locator("#f-title").fill(`Landing E2E ${rnd}`);
  await admin.locator("#f-slug").fill(`landing-e2e-${rnd}`);
  await admin.getByTestId("block-add-hero").click();
  await admin.getByTestId("block").nth(0).getByLabel("Titre", { exact: true }).fill(`Bandeau E2E ${rnd}`);
  await admin.getByTestId("block-add-cta").click();
  const cta = admin.getByTestId("block").nth(1);
  await cta.getByLabel("Titre", { exact: true }).fill("Besoin d'un devis ?");
  await cta.getByLabel("Bouton", { exact: true }).fill("Demander un devis");
  await cta.getByLabel("Lien", { exact: true }).fill("/devis");
  await admin.locator("#f-seoTitle").fill(`Landing E2E ${rnd} – FAW`);
  await admin.getByTestId("crud-save").click();
  await admin.waitForURL(/\/admin\/m\/landings\/\d+\?saved=1/, { timeout: 15_000 }).catch(() => {});
  const id = admin.url().match(/landings\/(\d+)/)?.[1];
  ok("landing : création avec blocs", id, norm(await admin.locator("[role=alert]").allTextContents().then((a) => a.join(" | "))));
  let res = await fetch(`${BASE}/l/landing-e2e-${rnd}`);
  ok("landing non publiée → 404", res.status === 404, `HTTP ${res.status}`);
  if (id) await save(admin, "landings", { published: true }, id);
  res = await fetch(`${BASE}/l/landing-e2e-${rnd}`);
  const html = await res.text();
  ok("landing publiée : blocs rendus + titre SEO", res.status === 200 && html.includes(`Bandeau E2E ${rnd}`) && html.includes("Demander un devis") && html.includes(`<title>Landing E2E ${rnd} – FAW</title>`), `HTTP ${res.status}`);
  const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
  ok("sitemap : landing publiée + /packs", sm.includes(`/l/landing-e2e-${rnd}`) && sm.includes("/packs"));
  const p = await newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${BASE}/l/landing-e2e-${rnd}`);
  ok("landing 390 px : pas de débordement", (await overflowX(p)) <= 0);
  await shot(p, "08-landing-390", true);
  await p.close();
  if (id) await save(admin, "landings", { published: false }, id);
}

/* ---------- 9. Popup newsletter (consentement + plafonnement) ---------- */
{
  const r = await save(admin, "popups", { name: `Popup E2E ${rnd}`, kind: "newsletter", title: `Newsletter E2E ${rnd}`, body: "Nouveautés FAW.", ctaLabel: "S'inscrire", trigger: "delay", delaySeconds: 1, paths: "/produits", frequency: "session", active: true });
  ok("popup : création", r.id, r.err);
  await sleep(31_000); // cache marchandisage (30 s)
  const unknown = await newPage({}, null);
  await unknown.goto(`${BASE}/produits`);
  await sleep(2500);
  ok("popup : jamais affiché tant que le consentement est inconnu (bandeau visible)", (await unknown.getByTestId("popup").count()) === 0);
  await unknown.context().close();
  const p = await newPage();
  await p.goto(`${BASE}/`);
  await sleep(2000);
  ok("popup : ciblage par chemin (absent de l'accueil)", (await p.getByTestId("popup").count()) === 0);
  await p.goto(`${BASE}/produits`);
  await p.getByTestId("popup").waitFor({ timeout: 6000 }).catch(() => {});
  ok("popup : affiché après le délai sur /produits", (await p.getByTestId("popup").count()) === 1);
  await shot(p, "09-popup-newsletter-1440");
  await p.getByTestId("popup-nl-email").fill(`e2e-${rnd}@exemple.ma`);
  ok("popup : bouton désactivé sans case de consentement", await p.getByTestId("popup-nl-submit").isDisabled());
  await p.getByTestId("popup-nl-consent").check();
  await p.getByTestId("popup-nl-submit").click();
  await p.getByTestId("popup-nl-done").waitFor({ timeout: 6000 }).catch(() => {});
  ok("newsletter : inscription enregistrée avec consentement", db(`select consent from NewsletterSubscriber where email='e2e-${rnd}@exemple.ma'`)[0]?.[0] === 1);
  await p.goto(`${BASE}/produits`);
  await sleep(2500);
  ok("popup : plafonné (pas réaffiché dans la session)", (await p.getByTestId("popup").count()) === 0);
  ok("popup consentement refusé : aucun stockage durable", !(await p.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("faw-popup-")))));
  await p.close();
  if (r.id) await save(admin, "popups", { active: false }, r.id);
}

/* ---------- 10. Analytics, paniers abandonnés, tableau de bord, PDF ---------- */
{
  const t = db("select typeof(updatedAt) from Cart limit 1")[0]?.[0];
  if (t === "integer") db("update Cart set updatedAt = updatedAt - 7200000 where orderNumber is null and itemCount > 0");
  await admin.goto(`${BASE}/admin/paniers`);
  const rows = await admin.getByTestId("cart-row").count();
  ok("paniers abandonnés : liste (panier de test vieilli de 2 h)", rows >= 1, `${rows} ligne(s), updatedAt ${t}`);
  if (rows) {
    await admin.getByTestId("cart-status").first().selectOption("perdu");
    await sleep(1200);
    ok("paniers : changement de statut enregistré", db("select count(*) from Cart where status='perdu'")[0][0] >= 1);
  }
  await shot(admin, "10-paniers-1440", true);
  await admin.goto(`${BASE}/admin/analytics?j=30`);
  ok("analytics : KPI + entonnoir + tableaux", (await admin.locator("[data-testid^=kpi-]").count()) >= 3 && (await admin.getByTestId("funnel-step").count()) >= 3 && (await admin.getByTestId("sources-table").count()) === 1);
  await shot(admin, "11-analytics-1440", true);
  await admin.goto(`${BASE}/admin/catalogue-pdf`);
  await shot(admin, "12-catalogue-pdf-1440");
  const res = await admin.context().request.get(`${BASE}/admin/catalogue-pdf/telecharger`);
  const buf = await res.body();
  ok("catalogue PDF : téléchargé (admin)", res.status() === 200 && buf.subarray(0, 4).toString() === "%PDF" && /no-store/.test(res.headers()["cache-control"] ?? ""));
  fs.writeFileSync("/tmp/faw-catalogue-e2e.pdf", buf);
  const txt = norm(execFileSync("pdftotext", ["-layout", "/tmp/faw-catalogue-e2e.pdf", "-"], { encoding: "utf8" }));
  ok("catalogue PDF : prix TTC, aucun mot interdit / fournisseur / prix d'achat", /TTC/.test(txt) && !FORBIDDEN.test(txt) && !/purchase|achat/i.test(txt), txt.slice(0, 120));
  ok("catalogue PDF : produit actif présent", txt.includes(`Produit test E2E ${rnd}`) || txt.includes("CF-EI60-90"));
}

/* ---------- 11. Médiathèque : validation des fichiers ---------- */
{
  await admin.goto(`${BASE}/admin/medias`);
  const before = db("select count(*) from Media")[0][0];
  const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#b87333" } }).png().toBuffer();
  await admin.getByTestId("media-file").setInputFiles({ name: `e2e-${rnd}.png`, mimeType: "image/png", buffer: png });
  await admin.getByTestId("media-submit").click();
  await admin.getByTestId("media-result").waitFor({ timeout: 10_000 }).catch(() => {});
  ok("médias : image valide acceptée (webp)", db("select count(*) from Media")[0][0] === before + 1 && /\.webp$/.test(db("select url from Media order by id desc limit 1")[0][0]));
  const mid = before + 1;
  await admin.getByTestId("media-file").setInputFiles({ name: "faux.png", mimeType: "image/png", buffer: Buffer.from("<?php echo 1; ?> pas une image") });
  await admin.getByTestId("media-submit").click();
  await sleep(1500);
  ok("médias : faux PNG refusé", db("select count(*) from Media")[0][0] === mid && (await admin.locator("[data-testid=media-result][role=alert]").count()) === 1, norm(await admin.getByTestId("media-result").textContent().catch(() => "")));
  await admin.getByTestId("media-file").setInputFiles({ name: "lourd.png", mimeType: "image/png", buffer: Buffer.concat([png, Buffer.alloc(5.5 * 1024 * 1024)]) });
  await admin.getByTestId("media-submit").click();
  await sleep(2500);
  ok("médias : fichier > 5 Mo refusé", db("select count(*) from Media")[0][0] === mid);
  const url = db("select url from Media order by id desc limit 1")[0][0];
  const anon = await fetch(BASE + url);
  ok("médias : servie publiquement en image/webp + nosniff", anon.status === 200 && anon.headers.get("content-type") === "image/webp" && anon.headers.get("x-content-type-options") === "nosniff");
  ok("médias : nom traversant refusé", (await fetch(BASE + "/media/..%2f..%2fprisma%2ffaw.db")).status >= 400);
  await shot(admin, "13-medias-1440", true);
}

/* ---------- 12. Utilisateurs & droits ---------- */
{
  const email = `viewer-${rnd}@exemple.ma`;
  const pw = `Lecture-E2E-${rnd}-ok!`;
  const r = await save(admin, "users", { email, name: `Lecteur E2E ${rnd}`, role: "viewer", active: true, password: pw });
  ok("utilisateur : création (rôle lecteur)", r.id, r.err);
  const hash = db(`select passwordHash from AdminUser where email='${email}'`)[0]?.[0] ?? "";
  ok("utilisateur : mot de passe haché scrypt (jamais en clair)", /scrypt/i.test(hash) && !hash.includes(pw));
  await admin.goto(`${BASE}/admin/m/users/${r.id}`);
  ok("utilisateur : mot de passe jamais réaffiché", (await admin.locator("#f-password").inputValue()) === "");
  const v = await newPage();
  await login(v, email, pw);
  ok("lecteur : connexion", (await v.getByTestId("dash-7d").count()) === 1 || (await v.locator("nav [data-testid^=nav-]").count()) > 0);
  await v.goto(`${BASE}/admin/m/products`);
  ok("lecteur : produits en lecture seule (pas de bouton Ajouter)", (await v.getByTestId("entity-table").count()) === 1 && (await v.getByTestId("entity-new").count()) === 0);
  await v.goto(`${BASE}/admin/m/products/${PID}`);
  ok("lecteur : fiche en lecture seule", (await v.getByTestId("crud-readonly").count()) === 1 && (await v.getByTestId("crud-save").count()) === 0);
  await v.goto(`${BASE}/admin/m/users`);
  ok("lecteur : module Utilisateurs refusé", (await v.getByTestId("no-access").count()) === 1 && !(await v.content()).includes(email.replace("viewer", "xx")) && (await v.getByTestId("entity-table").count()) === 0);
  ok("lecteur : liens admin-only masqués dans la nav", (await v.getByTestId("nav-users").count()) === 0 && (await v.getByTestId("nav-permissions").count()) === 0);
  await v.goto(`${BASE}/admin/m/coupons/nouveau`);
  ok("lecteur : création coupon impossible", (await v.getByTestId("crud-save").count()) === 0);
  await v.goto(`${BASE}/admin/paniers`);
  ok("lecteur : statut panier non modifiable", (await v.getByTestId("cart-status").count()) === 0 || (await v.getByTestId("cart-status").first().isDisabled()));
  await shot(v, "14-lecteur-lecture-seule-1440");
  await v.context().close();
  await admin.goto(`${BASE}/admin/m/audit`);
  ok("journal d'audit : créations tracées", /users|produit|products/i.test(norm(await admin.getByTestId("entity-table").textContent().catch(() => ""))));
  const lock = await newPage();
  for (let i = 0; i < 6; i++) {
    await lock.goto(BASE + "/admin");
    await lock.fill("#email", email);
    await lock.fill("#password", "mauvais-" + i);
    await lock.getByRole("button", { name: /connexion|se connecter|entrer/i }).click();
    await lock.waitForTimeout(400);
  }
  ok("utilisateur : verrouillage après échecs", db(`select lockedUntil is not null from AdminUser where email='${email}'`)[0]?.[0] === 1);
  await lock.context().close();
  if (r.id) await save(admin, "users", { active: false }, r.id);
}

/* ---------- 13. Débordement 390 / 1280 sur les modules ---------- */
{
  const pages = ["/admin", "/admin/analytics", "/admin/paniers", "/admin/m/products", `/admin/m/products/${PID}`, "/admin/m/promotions", "/admin/m/coupons", "/admin/m/landings/nouveau", "/admin/m/fee-rules", "/admin/medias", "/admin/catalogue-pdf", "/admin/permissions", "/packs"];
  const bad = [];
  for (const w of [390, 1280]) {
    await admin.setViewportSize({ width: w, height: 900 });
    for (const u of pages) {
      await admin.goto(BASE + u);
      const o = await overflowX(admin);
      if (o > 0) bad.push(`${w}:${u}(+${o})`);
    }
  }
  ok("aucun débordement horizontal 390/1280 (13 pages)", bad.length === 0, bad.join(" "));
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.goto(BASE + "/admin/m/products");
  await shot(admin, "15-produits-390");
  await admin.getByTestId("admin-menu-toggle").click();
  await shot(admin, "16-menu-mobile-390");
  await admin.goto(BASE + "/admin/analytics");
  await shot(admin, "17-analytics-390", true);
  await admin.setViewportSize({ width: 1280, height: 900 });
  await admin.goto(BASE + "/admin/m/products");
  await shot(admin, "18-produits-1280");
}

/* ---------- Nettoyage : désactivation (aucune suppression des données réelles ; base de test) ---------- */
{
  await save(admin, "products", { active: false }, PID);
  db(`update Promotion set active=0 where name like 'Promo E2E%'`);
  db(`update Coupon set active=0 where code like 'E2E%'`);
  db(`update Bundle set active=0 where slug like 'pack-e2e-%'`);
  db(`update Warranty set active=0 where name like 'Garantie E2E%'`);
  db(`update Badge set active=0 where label like 'Badge%' and label glob 'Badge[0-9]*'`);
  db(`update Redirect set active=0 where "from" like '/ancien-e2e-%' or "from" like '/csv-e2e-%'`);
  const res = await fetch(`${BASE}/produits/${PSLUG}`);
  ok("nettoyage : produit de test archivé (404)", res.status === 404, `HTTP ${res.status}`);
}

ok("aucune erreur console / page", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" || "));
await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
