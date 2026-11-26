import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3100";
const PHASE = process.env.PHASE || "before";
const OUT = "/workspace/faw-shop/shots/responsive";
const WIDTHS = [360, 390, 414, 768, 1024, 1280, 1440];
const HEIGHTS = { 360: 800, 390: 844, 414: 896, 768: 1024, 1024: 800, 1280: 800, 1440: 900 };

const PAGES = [
  { id: "home", path: "/" },
  { id: "catalogue", path: "/produits" },
  { id: "cat-portes-coupe-feu", path: "/produits/portes-coupe-feu" },
  { id: "cat-galandage", path: "/produits/portes-galandage" },
  { id: "cat-incendie", path: "/produits/incendie" },
  { id: "product", path: "/produits/cf-ei60-140-2v" },
  { id: "product-gal", path: "/produits/gal-800" },
  { id: "panier", path: "/panier" },
  { id: "devis", path: "/devis" },
  { id: "contact", path: "/contact" },
  { id: "blog", path: "/blog" },
  { id: "livraison", path: "/livraison" },
  { id: "legal-mentions", path: "/livraison#mentions" },
  { id: "legal-confidentialite", path: "/livraison#confidentialite" },
  { id: "sav", path: "/sav" },
  { id: "packs", path: "/packs" },
  { id: "not-found", path: "/page-introuvable-audit-responsive" },
];

const SHOT_PAGES = new Set(["home", "product", "devis", "catalogue"]);
const SHOT_WIDTHS = new Set([390, 768, 1024, 1440]);

async function discoverBlog(page) {
  try {
    await page.goto(`${BASE}/blog`, { waitUntil: "domcontentloaded", timeout: 20000 });
    const href = await page.locator('a[href^="/blog/"]').first().getAttribute("href").catch(() => null);
    if (href) PAGES.push({ id: "blog-post", path: href });
  } catch {}
}

function auditFn() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const root = document.documentElement;
  const body = document.body;
  const prevHtml = root.style.overflowX;
  const prevBody = body.style.overflowX;
  root.style.overflowX = "visible";
  body.style.overflowX = "visible";
  const docW = Math.max(root.scrollWidth, body.scrollWidth, root.clientWidth);
  root.style.overflowX = prevHtml;
  body.style.overflowX = prevBody;

  const isSkippable = (el) => {
    if (!el || el === document.documentElement || el === document.body) return true;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return true;
    if (el.classList?.contains("sr-only")) return true;
    const clip = style.clip || style.clipPath;
    if (clip && clip.includes("rect(0") || style.position === "absolute" && (parseFloat(style.width) <= 1 || el.classList?.contains("sr-only"))) return true;
    return false;
  };

  const clippedByAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== document.body) {
      const s = getComputedStyle(p);
      if (/(hidden|clip|scroll|auto)/.test(s.overflowX) || s.overflowX === "clip") {
        const pr = p.getBoundingClientRect();
        if (pr.width > 0 && pr.left >= -1 && pr.right <= vw + 1) return true;
      }
      p = p.parentElement;
    }
    return false;
  };

  const cardOverflows = [];
  for (const card of document.querySelectorAll("[data-testid=product-card]")) {
    const cr = card.getBoundingClientRect();
    if (cr.width < 1) continue;
    let worst = 0;
    let offender = "";
    for (const el of card.querySelectorAll("*")) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const over = r.right - cr.right;
      if (over > worst) {
        worst = over;
        offender = ((el.getAttribute("data-testid") || el.tagName) + " " + (el.innerText || "").replace(/\s+/g, " ")).slice(0, 80);
      }
    }
    if (worst > 1.5) cardOverflows.push({ over: Math.round(worst), offender, cardW: Math.round(cr.width) });
  }

  const overflowing = [];
  let maxRight = 0;
  for (const el of document.querySelectorAll("body *")) {
    if (isSkippable(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    const right = r.right + window.scrollX;
    const left = r.left + window.scrollX;
    if (clippedByAncestor(el)) continue;
    if (right > maxRight) maxRight = right;
    if (right > vw + 1.5 || left < -1.5) {
      overflowing.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute("data-testid") || "",
        id: el.id || "",
        cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 140),
        text: (el.innerText || "").replace(/\s+/g, " ").slice(0, 90),
        left: Math.round(left),
        right: Math.round(right),
        w: Math.round(r.width),
        h: Math.round(r.height),
      });
    }
  }
  overflowing.sort((a, b) => b.right - a.right);

  // Prefer unique "outermost" offenders
  const unique = [];
  for (const item of overflowing) {
    if (unique.length >= 20) break;
    if (unique.some((u) => item.cls.includes(u.cls.slice(0, 40)) && Math.abs(u.right - item.right) < 2)) continue;
    unique.push(item);
  }

  const smallTaps = [];
  for (const el of document.querySelectorAll('a, button, [role="button"], input:not([type="hidden"]), select, textarea, [role="tab"]')) {
    if (isSkippable(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    // ignore purely inline text links inside paragraphs
    const inParagraph = el.closest("p, li, address, td, th") && el.tagName === "A" && r.height < 44 && r.width > 40;
    if (inParagraph && !el.closest("nav, header, footer, [role=dialog], [data-testid]")) continue;
    if (r.width < 44 || r.height < 44) {
      smallTaps.push({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute("data-testid") || "",
        text: (el.getAttribute("aria-label") || el.innerText || "").replace(/\s+/g, " ").slice(0, 60),
        w: Math.round(r.width),
        h: Math.round(r.height),
        cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 80),
      });
    }
  }

  const stickyCovers = [];
  for (const el of document.querySelectorAll("body *")) {
    const s = getComputedStyle(el);
    if (s.position !== "sticky" && s.position !== "fixed") continue;
    const r = el.getBoundingClientRect();
    if (r.height < 8 || r.width < 8) continue;
    if (s.visibility === "hidden" || s.display === "none" || Number(s.opacity) === 0) continue;
    if (el.classList.contains("sr-only")) continue;
    // flag if a fixed/sticky bottom bar covers a large chunk of viewport
    if (s.position === "fixed" && r.bottom >= vh - 2 && r.height > vh * 0.35) {
      stickyCovers.push({ cls: (el.className || "").toString().slice(0, 80), h: Math.round(r.height), role: el.getAttribute("role") || el.id });
    }
  }

  const images = [];
  for (const img of document.querySelectorAll("img")) {
    const r = img.getBoundingClientRect();
    if (r.width < 40 || r.height < 40) continue;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) continue;
    const display = r.width / r.height;
    const natural = nw / nh;
    const fit = getComputedStyle(img).objectFit;
    // Distortion: stretched (not cover/contain) with ratio off by > 12%
    if (fit !== "cover" && fit !== "contain" && Math.abs(display - natural) / natural > 0.12) {
      images.push({ src: (img.getAttribute("src") || "").slice(0, 80), display: display.toFixed(2), natural: natural.toFixed(2), fit, w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  const menu = document.getElementById("mobile-nav");
  const menuOpen = !!(menu && getComputedStyle(menu).display !== "none");

  return {
    vw,
    vh,
    docW,
    maxRight: Math.round(maxRight),
    cardOverflows,
    overflow: docW > vw + 1 || maxRight > vw + 1.5 || cardOverflows.length > 0,
    overflowAmount: Math.max(0, Math.round(Math.max(docW, maxRight) - vw), ...(cardOverflows.map((c) => c.over))),
    overflowing: unique,
    smallTaps: smallTaps.slice(0, 25),
    smallTapCount: smallTaps.length,
    stickyCovers,
    distortedImages: images,
    menuOpen,
    hasConsent: !!document.querySelector("[data-testid=consent-banner]"),
    hasWa: !!document.querySelector('a[aria-label*="WhatsApp"], a[href*="wa.me"]'),
  };
}

async function run() {
  fs.mkdirSync(path.join(OUT, PHASE), { recursive: true });
  const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--disable-dev-shm-usage", "--no-sandbox"] });
  const context = await browser.newContext({
    locale: "fr-FR",
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    try { sessionStorage.setItem("faw-intro-v3", "1"); } catch {}
  });
  const page = await context.newPage();
  await discoverBlog(page);

  // Add a product to cart for panier-filled later
  const results = [];

  for (const width of WIDTHS) {
    const height = HEIGHTS[width] || 800;
    await page.setViewportSize({ width, height });

    for (const p of PAGES) {
      // Fresh consent so banner is visible on first visit of each width's home, then keep for others of this width after accepting? 
      // We audit twice on home at 390: with banner. For overflow, audit WITH banner (real user state first visit).
      await context.clearCookies();
      await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(250);
      // Skip intro if present
      await page.evaluate(() => { document.documentElement.dataset.intro = "done"; });

      const report = await page.evaluate(auditFn);
      const rec = { page: p.id, path: p.path, width, ...report };
      results.push(rec);

      if (SHOT_PAGES.has(p.id) && SHOT_WIDTHS.has(width)) {
        const dir = path.join(OUT, PHASE);
        await page.screenshot({ path: path.join(dir, `${p.id}-${width}-top.png`), fullPage: false });
        await page.screenshot({ path: path.join(dir, `${p.id}-${width}-full.png`), fullPage: true });
        // Scroll to product cards if catalogue/home
        if (p.id === "catalogue" || p.id === "home") {
          const card = page.locator("[data-testid=product-card]").first();
          if (await card.count()) {
            await card.scrollIntoViewIfNeeded();
            await page.waitForTimeout(150);
            await page.screenshot({ path: path.join(dir, `${p.id}-${width}-cards.png`), fullPage: false });
            const accept = page.locator("[data-testid=consent-accept]");
            if (await accept.count()) {
              await accept.click();
              await page.waitForTimeout(200);
              await card.scrollIntoViewIfNeeded();
              await page.screenshot({ path: path.join(dir, `${p.id}-${width}-cards-nobanner.png`), fullPage: false });
            }
          }
        }
      }

      // Mobile menu check at mobile widths on home
      if (p.id === "home" && width <= 414) {
        const btn = page.locator('header button[aria-controls="mobile-nav"]');
        if (await btn.count()) {
          await btn.click();
          await page.waitForTimeout(200);
          const menuReport = await page.evaluate(auditFn);
          results.push({ page: "home-menu", path: "/", width, ...menuReport });
          if (width === 390) {
            await page.screenshot({ path: path.join(OUT, PHASE, `home-${width}-menu.png`), fullPage: false });
          }
          await btn.click().catch(() => {});
          await page.waitForTimeout(100);
        }
      }
    }

    // Filled cart at this width (once per key widths)
    if (width === 390 || width === 1024 || width === 1440) {
      await page.goto(`${BASE}/produits/cf-ei60-140-2v`, { waitUntil: "networkidle", timeout: 30000 });
      const add = page.locator("[data-testid=add-to-cart], [data-testid=quick-add], button:has-text('Ajouter')").first();
      if (await add.count()) {
        await add.click().catch(() => {});
        await page.waitForTimeout(300);
      }
      await page.goto(`${BASE}/panier`, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(200);
      const cartReport = await page.evaluate(auditFn);
      results.push({ page: "panier-rempli", path: "/panier", width, ...cartReport });
      if (SHOT_WIDTHS.has(width)) {
        await page.screenshot({ path: path.join(OUT, PHASE, `panier-${width}-top.png`), fullPage: false });
      }
    }
  }

  const outFile = path.join(OUT, PHASE, "audit.json");
  fs.writeFileSync(outFile, JSON.stringify({ phase: PHASE, base: BASE, at: new Date().toISOString(), results }, null, 2));

  const overflows = results.filter((r) => r.overflow);
  const summary = {
    phase: PHASE,
    total: results.length,
    overflowCases: overflows.length,
    overflows: overflows.map((r) => ({
      page: r.page,
      width: r.width,
      vw: r.vw,
      docW: r.docW,
      maxRight: r.maxRight,
      amount: r.overflowAmount,
      elements: r.overflowing.slice(0, 5),
    })),
    smallTapsByPage: results
      .filter((r) => r.smallTapCount > 0 && (r.width === 390 || r.width === 768))
      .map((r) => ({ page: r.page, width: r.width, count: r.smallTapCount, samples: r.smallTaps.slice(0, 6) })),
  };
  fs.writeFileSync(path.join(OUT, PHASE, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
