// Parcours de bout en bout + captures. Usage : BASE=http://localhost:3100 node scripts/e2e.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3100";
const SHOTS = new URL("../shots/", import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);

const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`);
};

async function settle(page) {
  await page.waitForLoadState("networkidle");
  // déclenche les animations whileInView puis revient en haut
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  await page.waitForTimeout(900);
}
async function brokenImages(page) {
  return page.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
}
async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

const browser = await chromium.launch();
const consoleErrors = [];
const watch = (page) => {
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(`${page.url()} :: ${m.text()}`));
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
};

/* ---------------- Desktop ---------------- */
const desk = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light", locale: "fr-FR" });
const p = await desk.newPage();
watch(p);

await p.goto(BASE + "/");
await settle(p);
ok("home: h1 visible", await p.locator("h1").isVisible());
ok("home: no broken images", (await brokenImages(p)).length === 0, (await brokenImages(p)).join(", "));
ok("home: lang=fr dir=ltr", (await p.getAttribute("html", "dir")) === "ltr");
await p.screenshot({ path: SHOTS + "01-home-desktop-1440.png", fullPage: true });

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
const firstPrice = await p.getByTestId("product-card").first().locator("p").last().innerText();
ok("catalog: sort asc first is cheapest (340 DH)", /340/.test(firstPrice), firstPrice);
await p.getByTestId("sort").selectOption("default");
await p.waitForTimeout(600);
await settle(p);
ok("catalog: no broken images", (await brokenImages(p)).length === 0);
await p.screenshot({ path: SHOTS + "02-catalog-desktop.png", fullPage: true });

// Produit : porte 90 cm x2
await p.goto(BASE + "/produits/cf-ei60-90");
await p.waitForLoadState("networkidle");
ok("product: price shown", (await p.getByTestId("price").innerText()).includes("2\u202f200"));
const wa = await p.getByTestId("wa-product").getAttribute("href");
ok("product: WhatsApp link prefilled", wa.startsWith("https://wa.me/212660121813?text=") && decodeURIComponent(wa).includes("Porte coupe-feu EI60 90 cm"));
const ld = await p.locator('script[type="application/ld+json"]').first().innerText();
ok("product: JSON-LD Product MAD", ld.includes('"priceCurrency":"MAD"') && ld.includes('"price":"2200.00"'));
await p.getByRole("button", { name: "+1" }).click();
await p.getByTestId("add-to-cart").click();
await p.waitForTimeout(400);
ok("cart badge = 2", (await p.getByTestId("cart-count").innerText()) === "2");
// + un extincteur 6 kg
await p.goto(BASE + "/produits/ext-pabc-6");
await p.getByTestId("add-to-cart").click();
await p.waitForTimeout(400);
ok("cart badge = 3", (await p.getByTestId("cart-count").innerText()) === "3");
// produit sans image : placeholder
await p.goto(BASE + "/produits/ext-ria-30");
ok("product w/o image: placeholder", await p.locator('[role="img"][aria-label*="Visuel à venir"]').first().isVisible());

// Panier
await p.goto(BASE + "/panier");
await p.waitForLoadState("networkidle");
ok("cart: 2 lines", (await p.getByTestId("cart-lines").locator("li").count()) === 2);
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
await p.screenshot({ path: SHOTS + "03-cart-desktop.png", fullPage: true });

// Checkout
await p.getByTestId("go-checkout").click();
await p.waitForURL("**/commande");
await p.waitForLoadState("networkidle");
ok("checkout: no 'reception' payment for doors", (await p.getByTestId("payment-reception").count()) === 0);
await p.getByTestId("submit-order").click();
await p.waitForTimeout(1500);
ok("checkout: validation errors shown", (await p.locator("[role=alert]").count()) >= 2);
await p.reload();
await p.waitForLoadState("networkidle");
await p.fill("#customerName", "Test Playwright");
await p.fill("#phone", "06 60 00 00 00");
await p.fill("#city", "Rabat");
await p.fill("#address", "12 Avenue Test, Agdal");
await p.fill("#company", "Société Test SARL");
await p.fill("#ice", "001234567000089");
await p.getByTestId("payment-cheque").click();
await p.fill("#notes", "Commande de test automatisée (aperçu).");
await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await p.waitForTimeout(300);
await p.screenshot({ path: SHOTS + "04-checkout-desktop.png", fullPage: true });
await p.getByTestId("submit-order").click();
await p.waitForURL("**/commande/confirmation/**", { timeout: 15000 });
await p.waitForLoadState("networkidle");
await p.waitForTimeout(800);
const number = (await p.getByTestId("order-number").innerText()).trim();
ok("confirmation: order number", /^FAW-\d{6}-[0-9A-F]{6}$/.test(number), number);
const waC = decodeURIComponent(await p.getByTestId("wa-confirmation").getAttribute("href"));
ok("confirmation: WA summary prefilled", waC.includes(number) && waC.includes("Total : 5\u202f550"));
ok("confirmation: cart cleared", (await p.getByTestId("cart-count").count()) === 0);
await p.screenshot({ path: SHOTS + "05-confirmation-desktop.png", fullPage: true });

// Admin
await p.goto(BASE + "/admin/commandes");
ok("admin: login required", await p.locator("#password").isVisible());
await p.fill("#password", "mauvais");
await p.getByRole("button", { name: "Se connecter" }).click();
await p.waitForTimeout(1200);
ok("admin: wrong password rejected", await p.getByText("Mot de passe incorrect").isVisible());
await p.fill("#password", env.ADMIN_PASSWORD);
await p.getByRole("button", { name: "Se connecter" }).click();
await p.waitForSelector('[data-testid="orders-table"]', { timeout: 10000 });
ok("admin: order listed", await p.getByText(number).isVisible());
await p.screenshot({ path: SHOTS + "09-admin-commandes.png", fullPage: true });

// AR / RTL
await p.goto(BASE + "/");
await p.getByTestId("locale-toggle").first().click();
await p.waitForFunction(() => document.documentElement.dir === "rtl", null, { timeout: 10000 });
await settle(p);
ok("AR: html dir=rtl lang=ar", (await p.getAttribute("html", "lang")) === "ar");
ok("AR: nav translated", await p.getByRole("link", { name: "المتجر" }).first().isVisible());
ok("AR: no horizontal overflow", (await overflowX(p)) <= 0, String(await overflowX(p)));
await p.screenshot({ path: SHOTS + "06-home-ar-desktop.png", fullPage: true });
await p.goto(BASE + "/produits/cf-ei60-90");
await p.waitForLoadState("networkidle");
await p.screenshot({ path: SHOTS + "10-product-ar-desktop.png" });
await p.getByTestId("locale-toggle").first().click();
await p.waitForFunction(() => document.documentElement.dir === "ltr", null, { timeout: 10000 });
ok("AR toggle back to FR", true);

// Dark
await p.goto(BASE + "/");
await p.getByTestId("theme-toggle").click();
await p.waitForTimeout(300);
ok("dark: html.dark", await p.evaluate(() => document.documentElement.classList.contains("dark")));
await settle(p);
await p.screenshot({ path: SHOTS + "07-home-dark-desktop.png", fullPage: true });
await p.goto(BASE + "/produits/cf-ei60-140-2v");
await p.waitForLoadState("networkidle");
ok("dark persists across pages", await p.evaluate(() => document.documentElement.classList.contains("dark")));
await p.screenshot({ path: SHOTS + "11-product-dark-desktop.png" });
await desk.close();

/* ---------------- Kit seul : paiement à la réception ---------------- */
const kit = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const k = await kit.newPage();
watch(k);
await k.goto(BASE + "/produits/auto-gbat300-230v");
await k.getByTestId("add-to-cart").click();
await k.goto(BASE + "/commande");
await k.waitForLoadState("networkidle");
ok("kit-only: transporteur mode", (await k.getByTestId("delivery-transporteur").count()) === 1);
ok("kit-only: reception payment offered", (await k.getByTestId("payment-reception").count()) === 1);
await kit.close();

/* ---------------- Mobile ---------------- */
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "light" });
const m = await mob.newPage();
watch(m);
await m.goto(BASE + "/");
await settle(m);
ok("mobile home: no horizontal overflow", (await overflowX(m)) <= 0, String(await overflowX(m)));
await m.screenshot({ path: SHOTS + "08-home-mobile-390.png", fullPage: true });
await m.goto(BASE + "/produits/cf-ei60-120-2v");
await settle(m);
ok("mobile product: no horizontal overflow", (await overflowX(m)) <= 0, String(await overflowX(m)));
ok("mobile product: no broken images", (await brokenImages(m)).length === 0);
await m.screenshot({ path: SHOTS + "12-product-mobile-390.png", fullPage: true });
await m.getByRole("button", { name: "Menu" }).click();
await m.waitForTimeout(400);
ok("mobile menu opens", await m.locator("#mobile-nav").isVisible());
await m.goto(BASE + "/produits");
await settle(m);
ok("mobile catalog: no horizontal overflow", (await overflowX(m)) <= 0, String(await overflowX(m)));
await m.screenshot({ path: SHOTS + "13-catalog-mobile-390.png" });
await mob.close();

await browser.close();
const filtered = consoleErrors.filter((e) => !/favicon/.test(e));
ok("no console errors", filtered.length === 0, filtered.slice(0, 5).join(" | "));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
