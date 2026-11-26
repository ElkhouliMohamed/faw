// Parcours de bout en bout v2 + CRM + Meta Pixel + captures.
// Usage : BASE=http://localhost:3100 node scripts/e2e.mjs
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const ROOT = new URL("../", import.meta.url).pathname;
const SHOTS = ROOT + "shots/v3/e2e/";
fs.mkdirSync(SHOTS, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);
const products = JSON.parse(fs.readFileSync(ROOT + "data/products.json", "utf8"));
const prod = (id) => products.find((p) => p.id === id);

const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + String(extra).slice(0, 300) : ""}`);
};
const FORBIDDEN = /secours|\bEI\s?120\b|normes? europ|kingber|shaoxing|zhejiang|shangyu|\bchine\b|\bchina\b|\bd[ée]lai de livraison (garanti|de \d)|en \d+ ?(h|heures|jours) chrono|cr[ée]dit|mensualit|paiement en \d+ fois|carte bancaire/i;

async function settle(page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 140));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(1200);
}
const brokenImages = (page) => page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const cls = (page) => page.evaluate(() => new Promise((res) => {
  let v = 0;
  new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) v += e.value; }).observe({ type: "layout-shift", buffered: true });
  setTimeout(() => res(v), 400);
}));

const browser = await chromium.launch();
const consoleErrors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${page.url()} :: ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
};
const rnd = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const PHONE_LOCAL = `0661${rnd.slice(0, 6)}`; // 06 61 xx xx xx
const PHONE_NORM = `+212${PHONE_LOCAL.slice(1)}`;

/* ---------------- HTTP : redirections 301, sitemap, admin protégé ---------------- */
{
  const r = async (path) => { const res = await fetch(BASE + path, { redirect: "manual" }); return [res.status, res.headers.get("location") ?? ""]; };
  let [s, loc] = await r("/produits/CF-EI60-90");
  ok("301 uppercase id -> lowercase", s === 301 && loc.endsWith("/produits/cf-ei60-90"), `${s} ${loc}`);
  [s, loc] = await r("/portes");
  ok("301 /portes -> catalogue portes", s === 301 && loc.includes("/produits?categorie=portes-coupe-feu"), `${s} ${loc}`);
  [s, loc] = await r("/moteurs");
  ok("301 /moteurs -> automatisme", s === 301 && loc.includes("categorie=automatisme"), `${s} ${loc}`);
  [s, loc] = await r("/contact-us");
  ok("301 /contact-us -> /contact", s === 301 && loc.endsWith("/contact"), `${s} ${loc}`);
  [s, loc] = await r("/produit/GAL-800");
  ok("301 /produit/:slug -> /produits/:slug", s === 301 && loc.includes("/produits/GAL-800"), `${s} ${loc}`);
  const sm = await (await fetch(BASE + "/sitemap.xml")).text();
  const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok("sitemap: 29 product URLs, all lowercase ids", products.every((p) => urls.some((u) => u.endsWith(`/produits/${p.id.toLowerCase()}`))) && urls.filter((u) => u.includes("/produits/")).length === 29);
  const exp = await fetch(BASE + "/admin/clients/export");
  ok("CSV export refuses anonymous (401)", exp.status === 401);
  const anon = await (await fetch(BASE + "/admin/clients")).text();
  ok("admin clients: login wall, no data", anon.includes('id="password"') && !anon.includes('data-testid="contact-row"'));
}

/* ---------------- Contenu : toutes les pages produit ---------------- */
{
  let bad = [];
  let h1bad = [];
  for (const p of products) {
    const html = await (await fetch(`${BASE}/produits/${p.slug}`)).text();
    const text = html.replace(/Pas de crédit ni de paiement échelonné/g, "").replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    if (FORBIDDEN.test(text) || FORBIDDEN.test(html)) bad.push(p.id + ":" + (text.match(FORBIDDEN) || html.match(FORBIDDEN))[0]);
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
    if (title !== p.seoTitle) h1bad.push(`${p.id} title="${title}"`);
  }
  ok("29 product pages: no forbidden words (secours/EI120/normes/suppliers/credit/card)", bad.length === 0, bad.join(", "));
  ok("29 product pages: <title> = merchant-feed title", h1bad.length === 0, h1bad.slice(0, 3).join(" | "));
  for (const path of ["/", "/produits", "/livraison", "/contact", "/panier", "/commande"]) {
    const html = (await (await fetch(BASE + path)).text()).replace(/Pas de crédit ni de paiement échelonné/g, "");
    const m = html.match(FORBIDDEN);
    ok(`page ${path}: no forbidden words`, !m, m?.[0]);
  }
}

/* ---------------- Desktop ---------------- */
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", locale: "fr-FR" });
const p = await desk.newPage();
watch(p);

await p.goto(BASE + "/?utm_source=e2e&utm_medium=test&utm_campaign=crm-v2&gclid=GCLID-E2E");
await settle(p);
ok("home: h1 visible", await p.locator("h1").isVisible());
ok("home: no broken images", (await brokenImages(p)).length === 0, (await brokenImages(p)).join(", "));
ok("home: lang=fr dir=ltr", (await p.getAttribute("html", "dir")) === "ltr");
// v3 : le bandeau défilant (marquee) a été retiré par choix de design minimaliste ; on vérifie hero + catégories + intro.
ok("home: categories section + hero CTA present", (await p.locator("#collections").count()) === 1 && (await p.getByTestId("hero-shop").count()) === 1);
ok("home: intro finished (overlay gone)", (await p.evaluate(() => document.documentElement.dataset.intro)) === "done" && !(await p.getByTestId("intro").isVisible()));
await p.reload();
await p.waitForLoadState("networkidle");
ok("home: intro not replayed on reload (same session)", (await p.evaluate(() => document.documentElement.dataset.intro ?? "none")) === "none" && !(await p.getByTestId("intro").isVisible()));
ok("home: no Meta Pixel without ID", (await p.locator('script[src*="fbevents"]').count()) === 0 && (await p.evaluate(() => typeof window.fbq)) === "undefined");
const homeCls = await cls(p);
ok("home: CLS < 0.1", homeCls < 0.1, homeCls.toFixed(4));
ok("home: images have width/height or fill + sizes", await p.evaluate(() => [...document.images].every((i) => (i.getAttribute("width") && i.getAttribute("height")) || i.style.position === "absolute")));
await p.screenshot({ path: SHOTS + "home-desktop-1440.png", fullPage: true });
await p.screenshot({ path: SHOTS + "home-desktop-1440-fold.png" });
// vitrine épinglée : capture à mi-parcours (une capture pleine page ne peut pas montrer le défilement horizontal)
await p.evaluate(() => { const s = document.getElementById("collections"); window.scrollTo({ top: s.offsetTop + s.offsetHeight * 0.45, behavior: "instant" }); });
await p.waitForTimeout(1200);
await p.screenshot({ path: SHOTS + "home-desktop-1440-showcase.png" });
await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));

await p.goto(BASE + "/produits");
await p.waitForLoadState("networkidle");
ok("catalog: 29 products", (await p.getByTestId("product-card").count()) === 29);
await p.getByTestId("filter-incendie").click();
await p.waitForTimeout(500);
ok("catalog: incendie filter = 13", (await p.getByTestId("product-card").count()) === 13);
await p.getByTestId("search").fill("co2");
await p.waitForTimeout(500);
ok("catalog: search co2 = 3", (await p.getByTestId("product-card").count()) === 3);
await p.getByTestId("search").fill("");
await p.getByTestId("filter-all").click();
await p.getByTestId("sort").selectOption("asc");
await p.waitForTimeout(600);
const firstCard = await p.getByTestId("product-card").first().innerText();
ok("catalog: sort asc first is cheapest (340 DH)", /340/.test(firstCard), firstCard.replace(/\s+/g, " "));
await p.getByTestId("sort").selectOption("default");
await p.waitForTimeout(600);
await settle(p);
ok("catalog: no broken images", (await brokenImages(p)).length === 0);
await p.screenshot({ path: SHOTS + "catalog-desktop.png", fullPage: true });

// Produit : porte 90 cm
const P90 = prod("CF-EI60-90");
await p.goto(BASE + "/produits/cf-ei60-90");
await p.waitForLoadState("networkidle");
ok("product: H1 = merchant-feed title", (await p.locator("h1").innerText()).trim() === P90.seoTitle, await p.locator("h1").innerText());
ok("product: price '2 200 DH TTC'", (await p.getByTestId("price").innerText()).replace(/[\u202f\u00a0]/g, " ").includes("2 200 DH TTC"), await p.getByTestId("price").innerText());
ok("product: 'Pose non comprise'", (await p.getByTestId("install-note").innerText()).includes("Pose non comprise"));
const db = await p.getByTestId("delivery-block").innerText();
ok("product (porte): delivery Casablanca 400 / Rabat 800 / devis / retrait gratuit", /Casablanca[\s\S]*400/.test(db) && /Rabat[\s\S]*800/.test(db) && /sur devis/i.test(db) && /retrait[\s\S]*gratuit/i.test(db), db.replace(/\s+/g, " "));
const wa = await p.getByTestId("wa-product").getAttribute("href");
ok("product: WhatsApp prefilled with reference", wa.startsWith("https://wa.me/212660121813?text=") && decodeURIComponent(wa).includes("CF-EI60-90"));
const lds = await p.locator('script[type="application/ld+json"]').allInnerTexts();
const ld = lds.map((t) => JSON.parse(t)).find((j) => j["@type"] === "Product");
ok("product: JSON-LD Product+Offer (sku, MAD, InStock, brand)", ld && ld.sku === "CF-EI60-90" && ld.offers.priceCurrency === "MAD" && /InStock/.test(ld.offers.availability) && ld.brand.name === "FAW Aluminium" && ld.name === P90.seoTitle, JSON.stringify(ld).slice(0, 200));
ok("product: illustration non contractuelle", /(illustration|photo) non contractuelle/i.test(await p.locator("main").innerText()));
await settle(p);
await p.screenshot({ path: SHOTS + "product-desktop.png", fullPage: true });
await p.screenshot({ path: SHOTS + "product-desktop-fold.png" });
await p.getByRole("button", { name: "+1" }).click();
await p.getByTestId("add-to-cart").click();
await p.waitForTimeout(400);
ok("cart badge = 2", (await p.getByTestId("cart-count").innerText()) === "2");

// Kit + galandage : blocs livraison
await p.goto(BASE + "/produits/auto-gbat300-230v");
const kdb = await p.getByTestId("delivery-block").innerText();
ok("product (kit): transporteur partout au Maroc, frais à la réception", /transporteur/i.test(kdb) && /r[ée]ception/i.test(kdb), kdb.replace(/\s+/g, " "));
const kld = (await p.locator('script[type="application/ld+json"]').allInnerTexts()).map((t) => JSON.parse(t)).find((j) => j["@type"] === "Product");
ok("product (kit): JSON-LD brand Genius", kld.brand.name === "Genius");
ok("product (kit): 'Genius, fabriqué en Italie'", (await p.locator("main").innerText()).includes("Genius, fabriqué en Italie"));
await p.goto(BASE + "/produits/gal-800");
ok("product (galandage): livraison sur devis", /sur devis/i.test(await p.getByTestId("delivery-block").innerText()));

await p.goto(BASE + "/produits/ext-pabc-6");
await p.getByTestId("add-to-cart").click();
await p.waitForTimeout(400);
ok("cart badge = 3", (await p.getByTestId("cart-count").innerText()) === "3");
await p.goto(BASE + "/produits/ext-ria-30");
ok("product w/o image: placeholder", await p.locator('[role="img"][aria-label*="Visuel à venir"]').first().isVisible());

// Panier
await p.goto(BASE + "/panier");
await p.waitForLoadState("networkidle");
ok("cart: 2 lines", (await p.getByTestId("cart-lines").locator("li").count()) === 2);
ok("cart: steps indicator", (await p.locator('[aria-current="step"]').count()) === 1);
ok("cart: default Casablanca 400", (await p.getByTestId("delivery-fee").innerText()).includes("400"));
await p.getByTestId("delivery-rabat").click();
await p.waitForTimeout(300);
ok("cart: Rabat fee 800", (await p.getByTestId("delivery-fee").innerText()).includes("800"));
ok("cart: total 5 550", (await p.getByTestId("total").innerText()).includes("5\u202f550"), await p.getByTestId("total").innerText());
await p.getByTestId("delivery-retrait").click();
await p.waitForTimeout(300);
ok("cart: retrait gratuit total 4 750", (await p.getByTestId("total").innerText()).includes("4\u202f750"));
await p.getByTestId("delivery-rabat").click();
await p.waitForTimeout(300);
await settle(p);
await p.mouse.move(0, 0);
await p.screenshot({ path: SHOTS + "cart.png", fullPage: true });

// Checkout (lead n°1)
await p.getByTestId("go-checkout").click();
await p.waitForURL("**/commande");
await p.waitForLoadState("networkidle");
ok("checkout: no 'reception' payment for doors", (await p.getByTestId("payment-reception").count()) === 0);
await p.waitForFunction(() => document.querySelector('input[name="attribution"]')?.value.includes("crm-v2"), null, { timeout: 5000 }).catch(() => {});
ok("checkout: attribution captured", (await p.locator('input[name="attribution"]').inputValue()).includes("crm-v2"), await p.locator('input[name="attribution"]').inputValue());
await p.getByTestId("submit-order").click();
await p.waitForTimeout(1500);
ok("checkout: validation errors shown", (await p.locator("[role=alert]").count()) >= 2);
await p.reload();
await p.waitForLoadState("networkidle");
await p.fill("#customerName", `E2E Client ${rnd}`);
await p.fill("#phone", `${PHONE_LOCAL.slice(0, 2)} ${PHONE_LOCAL.slice(2, 4)} ${PHONE_LOCAL.slice(4, 6)} ${PHONE_LOCAL.slice(6, 8)} ${PHONE_LOCAL.slice(8)}`);
await p.fill("#city", "Rabat");
await p.fill("#address", "12 Avenue Test, Agdal");
await p.getByTestId("payment-cheque").click();
await p.fill("#notes", "Commande de test automatisée (aperçu).");
await settle(p);
await p.screenshot({ path: SHOTS + "checkout.png", fullPage: true });
await p.getByTestId("submit-order").click();
await p.waitForURL("**/commande/confirmation/**", { timeout: 15000 });
await p.waitForLoadState("networkidle");
await settle(p);
const number1 = (await p.getByTestId("order-number").innerText()).trim();
ok("confirmation: order number", /^FAW-\d{6}-[0-9A-F]{6}$/.test(number1), number1);
const waC = decodeURIComponent(await p.getByTestId("wa-confirmation").getAttribute("href"));
ok("confirmation: WA summary prefilled", waC.includes(number1) && waC.includes("Total : 5\u202f550"));
ok("confirmation: cart cleared", (await p.getByTestId("cart-count").count()) === 0);
await p.screenshot({ path: SHOTS + "confirmation.png", fullPage: true });

/* ---------------- Lead n°2, même téléphone (format international), autre navigateur ---------------- */
const kit = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const k = await kit.newPage();
watch(k);
await k.goto(BASE + "/produits/auto-gbat300-230v");
await k.getByTestId("add-to-cart").click();
await k.goto(BASE + "/commande");
await k.waitForLoadState("networkidle");
ok("kit-only: transporteur mode", (await k.getByTestId("delivery-transporteur").count()) === 1);
ok("kit-only: reception payment offered", (await k.getByTestId("payment-reception").count()) === 1);
await k.fill("#customerName", `E2E Client ${rnd} (bis)`);
await k.fill("#phone", `+212 ${PHONE_LOCAL.slice(1, 2)} ${PHONE_LOCAL.slice(2, 4)} ${PHONE_LOCAL.slice(4, 6)} ${PHONE_LOCAL.slice(6, 8)} ${PHONE_LOCAL.slice(8)}`);
await k.fill("#city", "Marrakech");
await k.fill("#address", "Zone industrielle Sidi Ghanem");
await k.fill("#company", `Revendeur E2E ${rnd}`);
await k.getByTestId("payment-reception").click();
await k.getByTestId("submit-order").click();
await k.waitForURL("**/commande/confirmation/**", { timeout: 15000 });
const number2 = (await k.getByTestId("order-number").innerText()).trim();
ok("lead 2 submitted", /^FAW-/.test(number2), number2);
await kit.close();

/* ---------------- Admin / CRM ---------------- */
await p.goto(BASE + "/admin/commandes");
ok("admin: login required", await p.locator("#password").isVisible());
await p.fill("#password", "mauvais");
await p.getByRole("button", { name: "Se connecter" }).click();
await p.waitForTimeout(1200);
ok("admin: wrong password rejected", await p.getByText("Mot de passe incorrect").isVisible());
await p.fill("#password", env.ADMIN_PASSWORD);
await p.getByRole("button", { name: "Se connecter" }).click();
await p.waitForSelector('[data-testid="orders-table"]', { timeout: 10000 });
ok("admin: both leads listed", (await p.getByText(number1).isVisible()) && (await p.getByText(number2).isVisible()));
await p.screenshot({ path: SHOTS + "admin-crm-commandes.png", fullPage: true });

await p.goto(BASE + `/admin/clients?q=${PHONE_LOCAL}`);
const rows = p.getByTestId("contact-row");
ok("CRM: lead created a contact (normalized phone)", (await rows.count()) === 1 && (await rows.first().getAttribute("data-phone")) === PHONE_NORM, `${await rows.count()} rows`);
ok("CRM: 2nd lead same phone merged (2 leads on 1 contact)", (await rows.first().getByTestId("contact-leads").innerText()).trim() === "2");
await rows.first().getByRole("link").first().click();
await p.waitForURL("**/admin/clients/*");
const contactUrl = p.url();
ok("CRM: contact keeps first name, gets B2B tag + entreprise", (await p.getByTestId("contact-name").innerText()) === `E2E Client ${rnd}` && (await p.getByTestId("contact-tag").allInnerTexts()).includes("B2B"));
ok("CRM: first-touch attribution stored (utm/gclid)", (await p.locator("main").innerText()).includes("e2e / test / crm-v2") && (await p.locator("main").innerText()).includes("GCLID-E2E"));

// Interaction + relance
await p.locator('label:has(input[value="appel"])').click();
await p.fill('textarea[name="note"]', `Appel e2e ${rnd} : devis demandé pour 2 portes.`);
await p.getByRole("button", { name: "Enregistrer", exact: true }).click();
await p.waitForTimeout(1000);
ok("CRM: interaction in timeline", (await p.getByTestId("timeline").innerText()).includes(`Appel e2e ${rnd}`));
await p.fill('input[name="title"]', `Relancer devis ${rnd}`);
await p.getByRole("button", { name: "Ajouter" }).click();
await p.waitForTimeout(1000);
ok("CRM: task added", (await p.getByTestId("task-item").allInnerTexts()).some((t) => t.includes(`Relancer devis ${rnd}`)));
await p.fill('[data-testid="tags-input"]', "B2B, revendeur, chantier");
await p.getByRole("button", { name: "Enregistrer la fiche" }).click();
await p.waitForTimeout(1000);
ok("CRM: tags editable", (await p.getByTestId("contact-tag").allInnerTexts()).includes("revendeur"));
await settle(p);
await p.screenshot({ path: SHOTS + "admin-crm-contact.png", fullPage: true });

// Pipeline : drag & drop + menu statut
await p.goto(BASE + "/admin/pipeline");
await p.waitForLoadState("networkidle");
const card1 = p.locator(`[data-testid="kanban-card"][data-number="${number1}"]`);
ok("pipeline: new lead in 'nouveau'", (await p.getByTestId("col-nouveau").locator(`[data-number="${number1}"]`).count()) === 1);
await card1.dragTo(p.getByTestId("col-contacté"), { sourcePosition: { x: 120, y: 34 }, targetPosition: { x: 120, y: 200 } });
await p.waitForTimeout(1500);
ok("pipeline: drag moves card (optimistic)", (await p.getByTestId("col-contacté").locator(`[data-number="${number1}"]`).count()) === 1);
await p.reload();
await p.waitForLoadState("networkidle");
ok("pipeline: drag to 'contacté' persists after reload", (await p.getByTestId("col-contacté").locator(`[data-number="${number1}"]`).count()) === 1);
await p.locator(`[data-testid="kanban-card"][data-number="${number2}"]`).getByTestId("card-status").selectOption("gagné");
await p.waitForTimeout(1500);
await p.reload();
await p.waitForLoadState("networkidle");
ok("pipeline: status select fallback persists ('gagné')", (await p.getByTestId("col-gagné").locator(`[data-number="${number2}"]`).count()) === 1);
const sumG = await p.getByTestId("col-gagné").getByTestId("col-sum").innerText();
ok("pipeline: column value in DH TTC", /DH TTC/.test(sumG), sumG);
await p.screenshot({ path: SHOTS + "admin-crm-pipeline.png", fullPage: true });

// Tableau de bord : Relances du jour
await p.goto(BASE + "/admin");
await p.waitForLoadState("networkidle");
ok("dashboard: task appears in 'Relances du jour'", (await p.getByTestId("relances").innerText()).includes(`Relancer devis ${rnd}`));
await p.screenshot({ path: SHOTS + "admin-crm-dashboard.png", fullPage: true });

// Contact : LTV + historique des statuts
await p.goto(contactUrl);
const tl = await p.getByTestId("timeline").innerText();
ok("CRM: timeline shows status changes", tl.includes("nouveau → contacté") && tl.includes("nouveau → gagné"));
{
  const kit = prod("AUTO-GBAT300-230V");
  const txt = (await p.locator("main").textContent()).replace(/[\u202f\u00a0]/g, " ");
  const want = `Valeur (gagné)${(kit.price).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} DH TTC`;
  ok("CRM: lifetime value = sum of 'gagné' leads (kit lead)", txt.includes(want), want);
}

// Liste + filtres + export CSV
await p.goto(BASE + "/admin/clients?tag=revendeur");
ok("clients: tag filter", (await p.locator(`[data-testid="contact-row"][data-phone="${PHONE_NORM}"]`).count()) === 1);
await p.goto(BASE + "/admin/clients?type=entreprise&statut=gagn%C3%A9");
ok("clients: type + status filter", (await p.locator(`[data-testid="contact-row"][data-phone="${PHONE_NORM}"]`).count()) === 1);
await p.goto(BASE + "/admin/clients?city=Tanger-inexistant");
ok("clients: city filter excludes", (await p.locator(`[data-testid="contact-row"][data-phone="${PHONE_NORM}"]`).count()) === 0);
const csv = await (await p.request.get(BASE + "/admin/clients/export")).text();
ok("clients: CSV export contains contact", csv.includes(PHONE_NORM) && csv.split("\n")[0].includes("telephone"));
await p.goto(BASE + "/admin/clients");
await p.screenshot({ path: SHOTS + "admin-crm-clients.png", fullPage: true });

// Création manuelle (merge si téléphone existant)
await p.goto(BASE + "/admin/clients/nouveau");
const PHONE3 = `0522${rnd.slice(0, 6)}`;
await p.fill('input[name="name"]', `Chantier manuel ${rnd}`);
await p.fill('input[name="phone"]', PHONE3);
await p.fill('input[name="city"]', "Casablanca");
await p.selectOption('select[name="type"]', "entreprise");
await p.fill('input[name="tags"]', "chantier");
await p.fill('input[name="value"]', "18000");
await p.selectOption('select[name="status"]', "devis envoyé");
await p.fill('textarea[name="leadNote"]', "8 portes coupe-feu EI60, parking R-1");
await p.screenshot({ path: SHOTS + "admin-crm-nouveau.png", fullPage: true });
await p.getByRole("button", { name: "Créer" }).click();
await p.waitForURL(/\/admin\/clients\/\d+$/, { timeout: 10000 });
ok("manual: contact + lead created", (await p.getByTestId("contact-name").innerText()) === `Chantier manuel ${rnd}` && (await p.getByTestId("contact-order").count()) === 1);
await desk.close();

/* ---------------- AR / RTL + dark ---------------- */
const ar = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" });
const a = await ar.newPage();
watch(a);
await a.goto(BASE + "/");
await a.getByTestId("locale-toggle").first().click();
await a.waitForFunction(() => document.documentElement.dir === "rtl", null, { timeout: 10000 });
await settle(a);
ok("AR: html dir=rtl lang=ar", (await a.getAttribute("html", "lang")) === "ar");
ok("AR: nav translated", await a.getByRole("link", { name: /المتجر/ }).first().isVisible());
ok("AR: no horizontal overflow", (await overflowX(a)) <= 0, String(await overflowX(a)));
await a.screenshot({ path: SHOTS + "home-ar.png", fullPage: true });
await a.goto(BASE + "/produits/cf-ei60-90");
await a.waitForLoadState("networkidle");
await a.screenshot({ path: SHOTS + "product-ar-fold.png" });
await a.getByTestId("locale-toggle").first().click();
await a.waitForFunction(() => document.documentElement.dir === "ltr", null, { timeout: 10000 });
await a.goto(BASE + "/");
await a.getByTestId("theme-toggle").click();
await a.waitForTimeout(300);
ok("dark: html.dark", await a.evaluate(() => document.documentElement.classList.contains("dark")));
await settle(a);
await a.screenshot({ path: SHOTS + "home-dark.png", fullPage: true });
await a.goto(BASE + "/produits/cf-ei60-140-2v");
await a.waitForLoadState("networkidle");
ok("dark persists across pages", await a.evaluate(() => document.documentElement.classList.contains("dark")));
await a.screenshot({ path: SHOTS + "product-dark-fold.png" });
await ar.close();

/* ---------------- Mobile ---------------- */
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
const m = await mob.newPage();
watch(m);
await m.goto(BASE + "/");
await settle(m);
ok("mobile home: no horizontal overflow", (await overflowX(m)) <= 0, String(await overflowX(m)));
await m.screenshot({ path: SHOTS + "home-mobile-390.png", fullPage: true });
await m.goto(BASE + "/produits/cf-ei60-120-2v");
await settle(m);
ok("mobile product: no horizontal overflow", (await overflowX(m)) <= 0, String(await overflowX(m)));
ok("mobile product: no broken images", (await brokenImages(m)).length === 0);
await m.screenshot({ path: SHOTS + "product-mobile-390.png", fullPage: true });
await m.getByRole("button", { name: "Menu" }).click();
await m.waitForTimeout(700);
ok("mobile menu opens", await m.locator("#mobile-nav").isVisible());
await m.screenshot({ path: SHOTS + "menu-mobile-390.png" });
await m.keyboard.press("Escape");
await m.goto(BASE + "/produits");
await settle(m);
ok("mobile catalog: no horizontal overflow", (await overflowX(m)) <= 0, String(await overflowX(m)));
await m.screenshot({ path: SHOTS + "catalog-mobile-390.png" });
await mob.close();

/* ---------------- Reduced motion : contenu visible sans animation ---------------- */
const rm = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const r = await rm.newPage();
watch(r);
await r.goto(BASE + "/");
await r.waitForLoadState("networkidle");
ok("reduced motion: hero h1 visible immediately", await r.locator("h1").isVisible());
ok("reduced motion: showcase not pinned (no 340vh)", (await r.locator("#collections").evaluate((el) => el.getBoundingClientRect().height)) < 2000);
await rm.close();

/* ---------------- Meta Pixel (2e serveur, ID factice, fbq stubé) ---------------- */
const DUMMY = "1234567890";
const srv = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", "3101", "-H", "127.0.0.1"], { cwd: ROOT, env: { ...process.env, NEXT_PUBLIC_META_PIXEL_ID: DUMMY }, stdio: "ignore" });
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch("http://127.0.0.1:3101/")).ok) break; } catch {}
    await new Promise((res) => setTimeout(res, 500));
  }
  const px = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await px.route(/connect\.facebook\.net/, (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "/* stub */" }));
  await px.addInitScript(() => {
    try { localStorage.setItem("faw-consent-v1", "granted"); } catch {}
    window.__fbqCalls = [];
    const f = function (...args) { window.__fbqCalls.push(args); };
    f.queue = []; f.loaded = true; f.version = "2.0";
    window.fbq = f;
    document.addEventListener("click", (e) => { if (e.target.closest?.('a[href^="tel:"], a[href*="wa.me"]')) e.preventDefault(); });
  });
  const x = await px.newPage();
  await x.goto("http://127.0.0.1:3101/");
  await x.waitForLoadState("networkidle");
  await x.waitForTimeout(500);
  let calls = await x.evaluate(() => window.__fbqCalls);
  const inited = calls.find((c) => c[0] === "init");
  ok("pixel: init with configured ID", inited && /^\d{5,20}$/.test(String(inited[1])), JSON.stringify(calls));
  ok("pixel: PageView on load", calls.filter((c) => c[0] === "track" && c[1] === "PageView").length === 1);
  ok("pixel: fbevents.js script requested", (await x.locator('script[src*="fbevents.js"]').count()) === 1);
  await x.locator('header a[href="/produits"]').first().click();
  await x.waitForURL("**/produits");
  await x.waitForTimeout(800);
  await x.locator('a[href="/produits/cf-ei60-90"]').first().click();
  await x.waitForURL("**/produits/cf-ei60-90");
  await x.waitForTimeout(1200);
  calls = await x.evaluate(() => window.__fbqCalls);
  const pvCount = calls.filter((c) => c[0] === "track" && c[1] === "PageView").length;
  ok("pixel: PageView on each client route change (home, catalogue, produit)", pvCount === 3 && calls.filter((c) => c[0] === "init").length === 1, `PageView x${pvCount}`);
  const vc = calls.find((c) => c[1] === "ViewContent");
  const vcPayload = { content_ids: ["CF-EI60-90"], content_name: P90.title, content_type: "product", value: 2200, currency: "MAD" };
  ok("pixel: ViewContent payload", vc && JSON.stringify(vc[2]) === JSON.stringify(vcPayload), JSON.stringify(vc));
  await x.getByTestId("add-to-cart").click();
  await x.waitForTimeout(400);
  calls = await x.evaluate(() => window.__fbqCalls);
  const atc = calls.find((c) => c[1] === "AddToCart");
  ok("pixel: AddToCart payload", atc && atc[2]?.content_ids?.[0] === "CF-EI60-90" && atc[2]?.value === 2200 && atc[2]?.currency === "MAD" && atc[2]?.content_name === P90.title, JSON.stringify(atc));
  await x.getByTestId("wa-product").click();
  await x.waitForTimeout(300);
  await x.locator('footer a[href^="tel:"]').first().click();
  await x.waitForTimeout(300);
  calls = await x.evaluate(() => window.__fbqCalls);
  const contacts = calls.filter((c) => c[1] === "Contact");
  ok("pixel: Contact on WhatsApp + tel: clicks", contacts.length === 2 && contacts[0][2].method === "whatsapp" && contacts[1][2].method === "phone", JSON.stringify(contacts));
  await px.close();
} finally {
  srv.kill("SIGTERM");
}

await browser.close();
const filtered = consoleErrors.filter((e) => !/favicon|127\.0\.0\.1:3101/.test(e));
ok("no console errors", filtered.length === 0, filtered.slice(0, 5).join(" | "));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
