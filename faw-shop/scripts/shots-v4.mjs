// Captures d'écran v4 (serveur de test :3200). Usage : BASE=http://127.0.0.1:3200 node scripts/shots-v4.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE ?? "http://127.0.0.1:3200";
const OUT = new URL("../shots/v4/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const consent = (ctx) => ctx.addInitScript(() => localStorage.setItem("faw-consent-v1", "denied"));
async function page(w, h, mobile = false) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile });
  await consent(ctx);
  return ctx.newPage();
}
const go = async (p, u) => {
  await p.goto(BASE + u); await p.waitForLoadState("networkidle"); await p.waitForTimeout(2600);
  // fait défiler la page pour déclencher les apparitions au scroll, puis revient en haut
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
  // capture pleine page : on force l'état final des animations d'apparition (le vrai défilement les déclenche déjà)
  await p.addStyleTag({ content: ".reveal{opacity:1!important;transform:none!important;translate:none!important}" });
  await p.waitForTimeout(600);
};

const d = await page(1440, 900), m = await page(390, 844, true);
await go(d, "/"); await d.screenshot({ path: OUT + "home-desktop.png", fullPage: true });
await go(m, "/"); await m.screenshot({ path: OUT + "home-mobile.png", fullPage: true });
await go(d, "/produits/portes-coupe-feu"); await d.screenshot({ path: OUT + "categorie-desktop.png", fullPage: true });
await go(m, "/produits/portes-coupe-feu"); await m.screenshot({ path: OUT + "categorie-mobile.png", fullPage: true });
await go(d, "/produits/cf-ei60-90"); await d.screenshot({ path: OUT + "produit-selecteur-desktop.png" });
await d.screenshot({ path: OUT + "produit-desktop-full.png", fullPage: true });
await go(m, "/produits/cf-ei60-90");
await m.getByTestId("variant-selector").first().scrollIntoViewIfNeeded().catch(() => {});
await m.screenshot({ path: OUT + "produit-selecteur-mobile.png" });
await m.screenshot({ path: OUT + "produit-mobile-full.png", fullPage: true });
await go(d, "/devis?ref=CF-EI60-90&qte=4"); await d.screenshot({ path: OUT + "devis-formulaire-desktop.png", fullPage: true });
await go(m, "/devis?ref=CF-EI60-90&qte=4"); await m.screenshot({ path: OUT + "devis-formulaire-mobile.png", fullPage: true });
// bot ouvert sur mobile
await go(m, "/");
await m.getByTestId("bot-toggle").click(); await m.waitForTimeout(500);
await m.screenshot({ path: OUT + "bot-mobile.png" });
// admin
const a = await page(1440, 900);
await a.goto(BASE + "/admin"); await a.fill("#password", process.env.ADMIN_PASSWORD);
await a.getByRole("button", { name: /se connecter/i }).click(); await a.waitForURL(/\/admin/); await a.waitForTimeout(800);
await go(a, "/admin/stock"); await a.screenshot({ path: OUT + "admin-stock.png", fullPage: true });
await a.screenshot({ path: OUT + "admin-stock-haut.png" });
// une demande « à valider » sur le serveur de TEST (aucun numéro consommé : le numéro n'est réservé qu'à « Valider »)
{
  const f = await page(1440, 900);
  await f.goto(BASE + "/devis?ref=CF-EI60-90&qte=2"); await f.waitForLoadState("networkidle"); await f.waitForTimeout(500);
  await f.fill("#name", "Test Captures A Valider"); await f.fill("#phone", "661234567"); await f.fill("#city", "Marrakech");
  await f.waitForTimeout(900); await f.getByTestId("quote-submit").click();
  await f.waitForURL(/\/devis\/confirmation\//, { timeout: 60_000 });
}
await go(a, "/admin/devis"); await a.screenshot({ path: OUT + "admin-devis.png", fullPage: true });
await a.screenshot({ path: OUT + "admin-devis-liste.png", fullPage: true });
await go(a, "/admin/devis?statut=" + encodeURIComponent("à valider"));
await a.getByTestId("devis-open").first().click(); await a.getByTestId("devis-detail").waitFor();
await a.getByTestId("devis-preview").evaluate((img) => img.complete || new Promise((r) => (img.onload = r)));
await a.waitForTimeout(600); await a.screenshot({ path: OUT + "admin-devis-detail.png", fullPage: true });
await go(a, "/admin/devis?statut=" + encodeURIComponent("validé"));
if (await a.getByTestId("devis-open").count()) {
  await a.getByTestId("devis-open").first().click(); await a.getByTestId("devis-detail").waitFor(); await a.waitForTimeout(600);
  await a.screenshot({ path: OUT + "admin-devis-detail-valide.png", fullPage: true });
}
await a.setViewportSize({ width: 390, height: 844 });
await go(a, "/admin/stock"); await a.screenshot({ path: OUT + "admin-stock-mobile.png" });
await b.close();
console.log("ok", fs.readdirSync(OUT).filter((f) => f.endsWith(".png")).join(" "));
