import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
const p = await ctx.newPage();
for (const s of ["200-2v", "120-1v"]) {
  await p.goto(`${BASE}/produits/cf-ei60-${s}`, { waitUntil: "networkidle" });
  const deny = p.getByTestId("consent-deny"); if (await deny.isVisible().catch(() => false)) await deny.click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `shots/v6/porte-${s}-desktop.png` });
  console.log(s, await p.evaluate(() => [...document.images].filter(i => i.currentSrc.includes("CF-EI60")).map(i => decodeURIComponent(i.currentSrc).match(/v7\/[^&]+/)?.[0]).filter(Boolean).slice(0, 3)));
}
await b.close();
