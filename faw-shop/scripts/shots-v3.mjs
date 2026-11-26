// Captures v3 + vérifications manuelles (intro, panier, RTL, sombre, débordements).
// Usage : BASE=http://localhost:3100 node scripts/shots-v3.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs";
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = new URL("../shots/v3/", import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);
const browser = await chromium.launch();
const errors = [];
const watch = (pg) => { pg.on("pageerror", (e) => errors.push(e.message)); pg.on("console", (m) => m.type() === "error" && errors.push(m.text())); };
const overflow = (pg) => pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
// capture pleine page : la révélation CSS (scroll-driven) est figée à son état final, comme après un défilement réel
const full = async (pg, path) => { await pg.addStyleTag({ content: ".reveal{animation:none!important}" }); await pg.screenshot({ path, fullPage: true }); };
const scrollAll = (pg) => pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 60)); } window.scrollTo({ top: 0, behavior: "instant" }); await new Promise((r) => setTimeout(r, 200)); });

// --- desktop 1440 : intro
const d = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "fr-FR" });
const p = await d.newPage(); watch(p);
const t0 = Date.now();
await p.goto(BASE + "/");
log("intro state after load:", await p.evaluate(() => document.documentElement.dataset.intro));
await p.waitForTimeout(Math.max(0, 900 - (Date.now() - t0)));
await p.screenshot({ path: OUT + "02-intro-midframe-1440.png" });
await p.waitForFunction(() => document.documentElement.dataset.intro === "done", null, { timeout: 4000 });
log("intro done after ms (wall, incl. navigation):", Date.now() - t0, "· performance.now at done:", Math.round(await p.evaluate(() => performance.now())));
await p.waitForTimeout(300);
await p.screenshot({ path: OUT + "01-home-desktop-1440.png" });
await scrollAll(p); await p.waitForTimeout(400);
await full(p, OUT + "01b-home-desktop-1440-full.png");
await p.reload();
log("intro state on reload (same session):", await p.evaluate(() => document.documentElement.dataset.intro ?? "none"), "visible:", await p.getByTestId("intro").isVisible());
// skip par touche dans une nouvelle session
{
  const c = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const q = await c.newPage();
  await q.goto(BASE + "/");
  await q.waitForTimeout(300);
  await q.keyboard.press("Space");
  const s = Date.now();
  await q.waitForFunction(() => document.documentElement.dataset.intro === "done", null, { timeout: 3000 });
  log("skip by key -> done in ms:", Date.now() - s);
  await q.goto(BASE + "/produits");
  log("intro on /produits:", await q.getByTestId("intro").count());
  await c.close();
  const rm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const r = await rm.newPage(); await r.goto(BASE + "/");
  log("reduced-motion intro visible:", await r.getByTestId("intro").isVisible(), r ? await r.evaluate(() => document.documentElement.dataset.intro ?? "none") : "");
  await rm.close();
}
// produit + panier
await p.goto(BASE + "/produits/cf-ei60-90");
await p.waitForLoadState("networkidle");
await p.screenshot({ path: OUT + "04-product-desktop-1440.png" });
await scrollAll(p);
await full(p, OUT + "04b-product-desktop-1440-full.png");
await p.getByTestId("add-to-cart").click();
await p.waitForTimeout(300);
log("cart count after add:", await p.getByTestId("cart-count").innerText());
await p.goto(BASE + "/produits");
await p.waitForLoadState("networkidle");
await p.getByTestId("quick-add").first().click();
await p.waitForTimeout(300);
log("cart count after quick add:", await p.getByTestId("cart-count").innerText());
await scrollAll(p);
await full(p, OUT + "06-catalog-desktop-1440.png");
await p.goto(BASE + "/panier");
await p.waitForLoadState("networkidle");
log("cart lines:", await p.getByTestId("cart-lines").locator("li").count(), (await p.getByTestId("cart-lines").innerText()).replace(/\s+/g, " ").slice(0, 200));
await full(p, OUT + "05-cart-desktop-1440.png");
// sombre
await p.goto(BASE + "/");
await p.getByTestId("theme-toggle").click();
await p.waitForTimeout(300);
await p.screenshot({ path: OUT + "07-home-dark-1440.png" });
await scrollAll(p);
await full(p, OUT + "07b-home-dark-1440-full.png");
await p.goto(BASE + "/produits/auto-gbat300-230v");
await p.waitForLoadState("networkidle");
await p.screenshot({ path: OUT + "07c-product-dark-1440.png" });
await p.getByTestId("theme-toggle").click();
// AR
await p.goto(BASE + "/");
await p.getByTestId("locale-toggle").first().click();
await p.waitForFunction(() => document.documentElement.dir === "rtl");
await p.waitForTimeout(500);
await p.screenshot({ path: OUT + "08-home-ar-1440.png" });
await scrollAll(p);
await full(p, OUT + "08b-home-ar-1440-full.png");
log("AR overflow:", await overflow(p));
await p.getByTestId("locale-toggle").first().click();
await p.waitForFunction(() => document.documentElement.dir === "ltr");
await d.close();

// mobile 390
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await m.newPage(); watch(mp);
await mp.goto(BASE + "/");
await mp.waitForTimeout(2400);
await mp.screenshot({ path: OUT + "03-home-mobile-390-screen1.png" });
await mp.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "instant" }));
await mp.waitForTimeout(700);
await mp.screenshot({ path: OUT + "03-home-mobile-390-screen2.png" });
await mp.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await scrollAll(mp);
await full(mp, OUT + "03b-home-mobile-390-full.png");
await mp.goto(BASE + "/produits/cf-ei60-120-2v");
await mp.waitForLoadState("networkidle");
await mp.screenshot({ path: OUT + "04c-product-mobile-390-fold.png" });
await mp.evaluate(() => window.scrollTo({ top: 1600, behavior: "instant" }));
await mp.waitForTimeout(600);
log("sticky bar shown:", await mp.getByTestId("sticky-buy").evaluate((e) => e.getAttribute("aria-hidden") !== "true"));
await mp.screenshot({ path: OUT + "04d-product-mobile-390-sticky.png" });
await mp.getByTestId("sticky-add-to-cart").click();
await mp.waitForTimeout(300);
log("mobile cart after sticky add:", await mp.getByTestId("cart-count").innerText());
await m.close();

// débordements
for (const w of [360, 390, 768, 1280, 1440]) {
  const c = await browser.newContext({ viewport: { width: w, height: 900 } });
  const q = await c.newPage();
  for (const path of ["/", "/produits", "/produits/cf-ei60-90", "/produits/auto-gbat300-230v", "/panier", "/livraison", "/contact", "/commande"]) {
    await q.goto(BASE + path);
    await q.waitForLoadState("networkidle");
    const o = await overflow(q);
    // éléments qui dépassent le viewport
    const bad = await q.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > window.innerWidth + 1 || r.left < -1) && !e.closest(".no-scrollbar,[role=tablist],.intro,[data-testid=sticky-buy]"); }).slice(0, 3).map((e) => e.tagName + "." + String(e.className).slice(0, 60)));
    if (o > 0 || bad.length) log(`overflow ${w} ${path}:`, o, bad);
  }
  await c.close();
}
log("errors:", errors);
await browser.close();
