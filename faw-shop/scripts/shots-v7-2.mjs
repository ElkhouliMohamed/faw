import { chromium } from "@playwright/test";
import fs from "node:fs";

const BASE = process.env.BASE || "http://127.0.0.1:3100";
const OUT = "/workspace/faw-shop/shots/v7-2";
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--headless=new"] });

async function shot(path, url, w = 1280, h = 800) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: "reduce", locale: "fr-FR" });
  await ctx.addInitScript(() => sessionStorage.setItem("faw-intro-v3", "1"));
  const p = await ctx.newPage();
  await p.goto(BASE + url, { waitUntil: "networkidle" });
  const deny = p.getByTestId("consent-deny");
  if (await deny.isVisible().catch(() => false)) await deny.click();
  await p.screenshot({ path: `${OUT}/${path}.png` });
  await ctx.close();
}

await shot("home-hero-desktop", "/", 1280, 800);
await shot("product-cf-ei60-100-desktop", "/produits/cf-ei60-100", 1280, 1600);
await shot("product-cf-ei60-140-2v-desktop", "/produits/cf-ei60-140-2v", 1280, 1600);
console.log("ok");
await b.close();
