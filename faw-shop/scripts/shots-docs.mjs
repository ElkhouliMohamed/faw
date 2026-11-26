// Sections « Fiche technique » et « Guide de pose & entretien » de cf-ei60-100 (desktop 1440, mobile 390) + JSON-LD.
import { chromium } from "@playwright/test";
const BASE = process.env.BASE || "http://localhost:3100";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
for (const [name, w, h] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/produits/cf-ei60-100`, { waitUntil: "networkidle" });
  const deny = p.getByTestId("consent-deny"); if (await deny.isVisible().catch(() => false)) await deny.click();
  if (name === "desktop") {
    const ld = await p.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => JSON.parse(x.textContent)).find((j) => j["@type"] === "Product"));
    console.log("subjectOf", JSON.stringify(ld.subjectOf));
    console.log("toc", await p.locator('nav[aria-label="Sommaire de la fiche"]').innerText());
  }
  await p.locator("#fiche-technique").screenshot({ path: `shots/v6/fiche-technique-${name}.png` });
  await p.locator("#installation").screenshot({ path: `shots/v6/fiche-technique-guide-entretien-${name}.png` });
  await p.locator('nav[aria-label="Sommaire de la fiche"] a[href="#entretien"]').click(); await p.waitForTimeout(800);
  await p.screenshot({ path: `shots/v6/fiche-technique-entretien-ancre-${name}.png` });
  const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 10000 }).catch(() => null), p.getByTestId("guide-pdf").click()]);
  console.log(name, "download:", dl ? dl.suggestedFilename() : "(ouvert dans un onglet)");
  await ctx.close();
}
await b.close();
