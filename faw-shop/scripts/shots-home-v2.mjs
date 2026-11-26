// Captures du hero fonctionnel (home v2) : desktop 1440 et mobile 390, FR + AR, + contrôles.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) for (const loc of ["fr", "ar"]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce" });
  await ctx.addCookies([{ name: "faw-locale", value: loc, url: BASE }]);
  await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
  const p = await ctx.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  const deny = p.getByTestId("consent-deny"); if (await deny.isVisible().catch(() => false)) await deny.click();
  const info = await p.evaluate(() => ({
    h1: [...document.querySelectorAll("h1")].map((x) => x.textContent.trim()),
    tiles: [...document.querySelectorAll("[data-testid=hero-cat]")].map((x) => x.innerText.replace(/\s+/g, " ")),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    canvas: document.querySelectorAll("canvas").length,
  }));
  console.log(name, loc, JSON.stringify(info));
  const suffix = loc === "fr" ? "" : "-ar";
  await p.screenshot({ path: `shots/v6/home-v2-${name}${suffix}.png` });
  if (loc === "fr") await p.screenshot({ path: `shots/v6/home-v2-${name}-full.png`, fullPage: true });
  await ctx.close();
}
// recherche
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
const p = await ctx.newPage(); await p.goto(BASE + "/", { waitUntil: "networkidle" });
await p.fill("#hero-q", "galandage"); await Promise.all([p.waitForURL(/produits/), p.press("#hero-q", "Enter")]);
console.log("search ->", p.url().replace(BASE, ""));
await b.close();
