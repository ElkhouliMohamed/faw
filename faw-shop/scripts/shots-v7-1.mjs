import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const OUT = "/workspace/faw-shop/shots/v7-1";
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--headless=new"] });

async function open(width, height) {
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: "reduce", locale: "fr-FR" });
  await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
  const p = await ctx.newPage();
  return { ctx, p };
}

async function dismiss(p) {
  const deny = p.getByTestId("consent-deny");
  if (await deny.isVisible().catch(() => false)) await deny.click();
}

const report = {};
for (const [name, w, h] of [["desktop", 1280, 800], ["mobile", 390, 844]]) {
  const { ctx, p } = await open(w, h);
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await dismiss(p);
  const cta = p.getByTestId("hero-quote");
  const color = await cta.evaluate((el) => {
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, fg: s.color, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height };
  });
  report[name] = color;
  await p.screenshot({ path: `${OUT}/home-hero-${name}.png` });
  await ctx.close();

  const product = await open(w, h);
  await product.p.goto(BASE + "/produits/cf-ei60-100", { waitUntil: "networkidle" });
  await dismiss(product.p);
  await product.p.screenshot({ path: `${OUT}/product-cf-ei60-100-${name}.png` });
  const table = product.p.getByTestId("spec-table");
  await table.scrollIntoViewIfNeeded();
  await product.p.screenshot({ path: `${OUT}/product-cf-ei60-100-specs-${name}.png` });
  await product.ctx.close();

  const listing = await open(w, h);
  await listing.p.goto(BASE + "/produits/portes-coupe-feu", { waitUntil: "networkidle" });
  await dismiss(listing.p);
  const card = listing.p.getByTestId("product-height").first();
  await card.scrollIntoViewIfNeeded();
  await listing.p.screenshot({ path: `${OUT}/listing-portes-coupe-feu-${name}.png` });
  await listing.ctx.close();
}

console.log(JSON.stringify(report, null, 2));
await b.close();
