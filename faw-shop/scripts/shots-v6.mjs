// Captures v6 : accueil, boutique, fiche porte coupe-feu (1440 + 390) et formulaire produit Filament (instance /tmp isolée).
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3100";
const ADMIN = process.env.ADMIN_BASE || "http://127.0.0.1:8010";
const OUT = new URL("../shots/v6/", import.meta.url).pathname;
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const pages = [["home", "/"], ["catalogue", "/produits"], ["produit-cf-ei60-140-2v", "/produits/cf-ei60-140-2v"]];
for (const [w, h, tag] of [[1440, 900, "desktop-1440"], [390, 844, "mobile-390"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag.startsWith("mobile") ? 2 : 1 });
  await ctx.addInitScript(() => { try { sessionStorage.setItem("faw-intro-v3", "1"); localStorage.setItem("faw-consent", JSON.stringify({ v: 1, analytics: false, ads: false })); } catch {} });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(BASE + path, { waitUntil: "networkidle" });
    const deny = page.getByTestId("consent-deny");
    if (await deny.isVisible().catch(() => false)) await deny.click();
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}${name}-${tag}.png` });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}${name}-${tag}-full.png`, fullPage: true });
    if (name.startsWith("produit") && tag.startsWith("mobile")) {
      await page.evaluate(() => window.scrollTo(0, 1800)); await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}${name}-${tag}-sticky.png` });
    }
  }
  await ctx.close();
}
// Filament (copie /tmp, compte de capture temporaire)
const pw = fs.readFileSync("/tmp/faw-shot.pw", "utf8");
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
await page.goto(ADMIN + "/admin/login", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}admin-login-desktop-1440.png` });
await page.fill('input[type="email"]', "capture@faw.test");
await page.fill('input[type="password"]', pw);
await page.click('button[type="submit"]');
await page.waitForURL(/\/admin(\/)?$/, { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}admin-dashboard-desktop-1440.png` });
await page.goto(ADMIN + "/admin/products", { waitUntil: "networkidle" });
await page.locator('input[type="search"]').first().fill("CF-EI60-140-2V");
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Ouvrir/ }).first().click();
await page.waitForSelector("text=Fiche produit", { timeout: 15000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}admin-product-edit-desktop-1440.png` });
await page.getByText("Fiche produit").first().scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}admin-product-edit-fiche-desktop-1440.png` });
await browser.close();
console.log("ok");
