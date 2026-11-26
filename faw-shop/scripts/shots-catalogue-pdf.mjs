// Carte « Catalogue portes coupe-feu (PDF) » dans la section Fiche technique (desktop 1440, mobile 390) + JSON-LD sans le catalogue.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/produits/cf-ei60-100`, { waitUntil: "networkidle" });
  const deny = p.getByTestId("consent-deny"); if (await deny.isVisible().catch(() => false)) await deny.click();
  const ld = await p.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent).join(" "));
  console.log(name, "card:", (await p.getByTestId("datasheet-pdf").innerText()).replace(/\s+/g, " "), "| catalogue dans JSON-LD:", ld.includes("faw-catalogue"));
  await p.locator("#fiche-technique").scrollIntoViewIfNeeded();
  await p.locator("#fiche-technique").screenshot({ path: `shots/v6/catalogue-pdf-${name}.png` });
  await ctx.close();
}
await b.close();
