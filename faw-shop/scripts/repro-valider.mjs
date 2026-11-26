// Repro « Valider » d'un devis dans Filament, contre une pile de COPIE uniquement (php -S :8011 sur une base /tmp,
// compteur/journal/générateur copiés dans /tmp). Ne jamais pointer BASE sur :3100/:8000 ni sur le tunnel public.
// Usage : BASE=http://127.0.0.1:8011 EMAIL=… PASS=… OUT=/tmp/x CLIENT=walid node scripts/repro-valider.mjs
import { chromium } from "playwright";
const base = process.env.BASE || "http://127.0.0.1:8011";
if (/:(3100|8000)\b|ngrok/.test(base)) throw new Error("Pile de copie uniquement.");
const out = process.env.OUT || "/tmp";
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome" });
const p = await b.newPage({ ignoreHTTPSErrors: true, viewport: { width: 1400, height: 900 } });
p.on("response", (r) => { if (r.status() >= 400) console.log("HTTP", r.status(), r.url()); });
p.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text()); });
await p.goto(base + "/admin/login");
await p.fill('input[type="email"]', process.env.EMAIL);
await p.fill('input[type="password"]', process.env.PASS);
await p.click('button[type="submit"]');
await p.waitForURL((u) => /\/admin(\/|$)/.test(u.pathname) && !u.pathname.endsWith("/login"));
await p.goto(base + "/admin/quotes");
await p.waitForLoadState("networkidle");
const row = p.locator("tr", { hasText: process.env.CLIENT || "walid" }).first();
await row.getByRole("button", { name: "Valider", exact: true }).click();
await p.waitForTimeout(800);
await p.locator(".fi-modal-window button", { hasText: /Confirmer|Confirm|Valider/ }).last().click();
await p.waitForTimeout(4000);
console.log("NOTIF:", (await p.locator(".fi-no-notification").allInnerTexts()).join(" | "));
await p.screenshot({ path: out + "/valider.png" });
await b.close();
