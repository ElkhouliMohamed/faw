// FR -> AR -> FR sur accueil, boutique, fiche produit ; desktop 1440 et mobile 390 ; + URL ?lang=ar et filtres boutique.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
const BASE = process.env.BASE || "http://localhost:3100";
const OUT = "shots/v6"; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
let fails = 0;
const PACE = Number(process.env.PACE ?? 25000);
const ok = (c, m) => { console.log((c ? "ok  " : "FAIL") + " " + m); if (!c) fails++; };
const state = (p) => p.evaluate(() => `${document.documentElement.lang}/${document.documentElement.dir}`);
async function toggle(p, mobile) {
  if (mobile) { const m = p.locator("button[aria-controls=mobile-nav]"); if ((await m.getAttribute("aria-expanded")) !== "true") await m.click(); }
  await Promise.all([p.waitForEvent("load"), p.locator("[data-testid=locale-toggle]:visible").first().click()]);
  await p.waitForLoadState("networkidle");
}
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const mobile = w < 1024;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, extraHTTPHeaders: { "ngrok-skip-browser-warning": "1" } });
  await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
  const p = await ctx.newPage();
  for (const path of ["/", "/produits", "/produits/cf-ei60-140-2v"]) {
    await p.waitForTimeout(PACE); // l'API limite à 120 lectures/min (127.0.0.1 partagé) : on espace les rechargements
    await p.goto(BASE + path, { waitUntil: "networkidle" });
    const deny = p.getByTestId("consent-deny"); if (await deny.isVisible().catch(() => false)) await deny.click();
    ok((await state(p)) === "fr/ltr", `${name} ${path} start fr`);
    for (let round = 1; round <= 2; round++) {
      await toggle(p, mobile);
      ok((await state(p)) === "ar/rtl", `${name} ${path} round ${round} -> ar/rtl`);
      if (path === "/" && round === 1) await p.locator("header").screenshot({ path: `${OUT}/locale-header-ar-${name}.png` });
      await p.reload({ waitUntil: "networkidle" });
      ok((await state(p)) === "ar/rtl", `${name} ${path} round ${round} ar persists on reload`);
      await toggle(p, mobile);
      ok((await state(p)) === "fr/ltr", `${name} ${path} round ${round} -> fr/ltr`);
      const navTxt = mobile ? await p.locator("button[aria-controls=mobile-nav]").getAttribute("aria-label") : await p.locator("nav[aria-label='Navigation principale']").innerText();
      ok(mobile ? navTxt === "Menu" : navTxt.includes("Boutique"), `${name} ${path} round ${round} French UI visible (${navTxt.replace(/\s+/g, " ").slice(0, 40)})`);
      if (path === "/" && round === 1) await p.locator("header").screenshot({ path: `${OUT}/locale-header-fr-retour-${name}.png` });
      await p.reload({ waitUntil: "networkidle" });
      ok((await state(p)) === "fr/ltr", `${name} ${path} round ${round} fr persists on reload`);
    }
  }
  await p.waitForTimeout(PACE);
  // Arrivée par une URL hreflang ?lang=ar, puis filtre boutique (history.replaceState), puis retour FR.
  await p.goto(BASE + "/produits?lang=ar", { waitUntil: "networkidle" });
  ok((await state(p)) === "ar/rtl", `${name} /produits?lang=ar -> ar`);
  await p.getByTestId("filter-available").check(); await p.waitForTimeout(500);
  await toggle(p, mobile);
  ok((await state(p)) === "fr/ltr" && !p.url().includes("lang="), `${name} ?lang=ar + filtre -> fr (${p.url().replace(BASE, "")})`);
  await p.reload({ waitUntil: "networkidle" });
  ok((await state(p)) === "fr/ltr", `${name} ?lang=ar case: fr persists on reload`);
  await ctx.close();
}
await b.close();
console.log(fails ? `${fails} FAIL` : "ALL OK");
process.exit(fails ? 1 : 0);
