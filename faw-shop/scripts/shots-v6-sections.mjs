import { chromium } from "@playwright/test";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
for (const [w,h,tag] of [[1440,900,"desktop-1440"],[390,844,"mobile-390"]]) {
const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag.startsWith("m")?2:1 });
await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
const p = await ctx.newPage();
await p.goto("http://localhost:3100/", { waitUntil: "networkidle" });
const d = p.getByTestId("consent-deny"); if (await d.isVisible().catch(()=>false)) await d.click();
await p.locator("#collections").scrollIntoViewIfNeeded(); await p.evaluate(()=>window.scrollBy(0,-40)); await p.waitForTimeout(1200);
await p.screenshot({ path: `/workspace/faw-shop/shots/v6/home-categories-${tag}.png` });
await p.locator("footer").scrollIntoViewIfNeeded(); await p.waitForTimeout(800);
await p.screenshot({ path: `/workspace/faw-shop/shots/v6/home-footer-${tag}.png` });
await ctx.close(); }
await b.close();
