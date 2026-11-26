// E2E v4 : variantes, panier, devis automatique (copie de test du générateur), refus, admin Stock/Devis,
// sécurité (en-têtes, verrouillage, honeypot), bot, responsive, sombre, arabe.
// Usage : ./scripts/start-test-server.sh && BASE=http://127.0.0.1:3200 node scripts/e2e.mjs
// Le compteur et le journal RÉELS ne sont jamais utilisés : le serveur de test pointe sur /tmp/faw-devis-test.
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";

const BASE = process.env.BASE || "http://127.0.0.1:3200";
const ROOT = new URL("../", import.meta.url).pathname;
const TEST = "/tmp/faw-devis-test";
const REAL = "/workspace/meta-closer/devis";
const OUT = ROOT + "shots/v4/e2e/";
fs.mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(
  fs.readFileSync(ROOT + ".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }),
);
const sha = (f) => (fs.existsSync(f) ? createHash("sha256").update(fs.readFileSync(f)).digest("hex") : "absent");
const realBefore = [sha(`${REAL}/compteur-devis.txt`), sha(`${REAL}/journal-devis.csv`)];

const results = [];
const ok = (name, cond, extra = "") => {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + String(extra).slice(0, 300) : ""}`);
};
const FORBIDDEN = /secours|\bEI\s?120\b|normes? europ|(pose|installation)\s+(offerte|gratuite|incluse)|\bremise\b|cr[ée]dit|mensualit|carte bancaire/i;
const counter = () => Number(fs.readFileSync(`${TEST}/devis/compteur-devis.txt`, "utf8").trim());
const journalRows = () => fs.readFileSync(`${TEST}/devis/journal-devis.csv`, "utf8").trim().split("\n").slice(1);
const pdfs = () => fs.readdirSync(`${TEST}/out`).filter((f) => f.endsWith(".pdf"));
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SHOTS = ROOT + "shots/v4/";

// API Resend simulée (127.0.0.1:3299) : le serveur de test y envoie les e-mails (RESEND_API_BASE_URL), jamais à l'API réelle.
const mail = { mode: "ok", reqs: [] };
const mock = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    if (req.method !== "POST" || req.url !== "/emails") return res.writeHead(404).end();
    let body = {};
    try { body = JSON.parse(b); } catch {}
    mail.reqs.push({ auth: req.headers.authorization, idem: req.headers["idempotency-key"], body, mode: mail.mode });
    if (mail.mode === "500") return res.writeHead(500, { "content-type": "application/json" }).end(JSON.stringify({ name: "internal_server_error", message: "panne simulée" }));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `mock-${mail.reqs.length}` }));
  });
});
await new Promise((r) => mock.listen(3299, "127.0.0.1", r));
const suivi = async (token) => {
  const r = await fetch(`${BASE}/devis/suivi/${token}`);
  const html = await r.text();
  return { status: r.status, html, state: html.match(/data-testid="quote-suivi"[^>]*data-state="([^"]+)"|data-state="([^"]+)"[^>]*data-testid="quote-suivi"/)?.slice(1).find(Boolean), headers: r.headers };
};

const browser = await chromium.launch();
const consoleErrors = [];
async function newPage(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  await ctx.addInitScript(() => {
    try { if (!localStorage.getItem("faw-consent-v1")) localStorage.setItem("faw-consent-v1", "denied"); } catch {}
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => consoleErrors.push(`${page.url()} :: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && !/favicon|Failed to load resource/.test(m.text()) && consoleErrors.push(`${page.url()} :: ${m.text()}`));
  return page;
}
const rnd = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");

/* ---------- En-têtes (curl -I) ---------- */
{
  const h = execFileSync("curl", ["-sI", BASE + "/"], { encoding: "utf8" }).toLowerCase();
  const csp = h.match(/content-security-policy: ([^\r\n]+)/)?.[1] ?? "";
  ok("CSP présente, sans unsafe-eval, avec nonce", csp && !csp.includes("unsafe-eval") && csp.includes("nonce-"), csp.slice(0, 120));
  ok("CSP frame-ancestors 'none' + X-Frame-Options DENY", csp.includes("frame-ancestors 'none'") && h.includes("x-frame-options: deny"));
  ok("HSTS", h.includes("strict-transport-security: max-age="));
  ok("Referrer-Policy / Permissions-Policy / nosniff", h.includes("referrer-policy:") && h.includes("permissions-policy:") && h.includes("x-content-type-options: nosniff"));
  ok("pas d'en-tête x-powered-by", !h.includes("x-powered-by"));
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  ok("robots.txt : admin exclu (ou tout le site si NOINDEX=1)", /Disallow: \/admin/.test(robots) || /Disallow: \/\s*(\n|$)/.test(robots), robots.replace(/\n/g, " | ").slice(0, 160));
  const adminH = execFileSync("curl", ["-sI", BASE + "/admin"], { encoding: "utf8" }).toLowerCase();
  ok("admin : noindex", adminH.includes("x-robots-tag: noindex") || (await (await fetch(BASE + "/admin")).text()).includes('name="robots" content="noindex'));
  const home = await (await fetch(BASE + "/")).text();
  ok("nav publique sans lien admin", !/href="\/admin/.test(home));
}

/* ---------- Fiche produit : sélecteur de taille, prix + photo, panier ---------- */
const page = await newPage();
{
  await page.goto(BASE + "/produits/cf-ei60-90");
  await page.waitForLoadState("networkidle");
  const h1 = (await page.getByTestId("product-h1").textContent()).trim();
  ok("H1 produit court (≤60)", h1.length <= 60, h1);
  ok("spec line + tableau + paragraphe SEO", (await page.getByTestId("spec-line").count()) && (await page.getByTestId("spec-table").count()) && (await page.getByTestId("seo-paragraph").count()));
  const sel = page.getByTestId("variant-selector");
  const img0 = await sel.locator("img").first().getAttribute("src");
  const p0 = await page.getByTestId("variant-price").textContent();
  await page.getByTestId("variant-CF-EI60-140-2V").click();
  await page.waitForFunction((p) => document.querySelector('[data-testid="variant-price"]')?.textContent !== p, p0);
  const p1 = await page.getByTestId("variant-price").textContent();
  const img1 = await sel.locator("img").first().getAttribute("src");
  ok("taille : le prix change immédiatement", /5\s?800/.test(p1.replace(/\u202f|\u00a0/g, " ")), `${p0} → ${p1}`);
  ok("taille : la photo d'exemple change", img0 !== img1 && /CF-EI60-140-2V/.test(decodeURIComponent(img1 ?? "")), `${img0} → ${img1}`);
  await page.waitForURL(/\/produits\/cf-ei60-140-2v$/);
  await page.waitForLoadState("networkidle");
  ok("taille : la fiche de la taille est chargée (URL + prix)", /5\s?800/.test((await page.getByTestId("price").textContent()).replace(/\u202f|\u00a0/g, " ")));
  const ld = await page.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent).join("\n"));
  ok("JSON-LD Product + Offer + Breadcrumb", ld.includes('"Product"') && ld.includes('"Offer"') && ld.includes("BreadcrumbList") && ld.includes("InStock"));
  await page.getByTestId("add-to-cart").click();
  await page.goto(BASE + "/panier");
  await page.waitForLoadState("networkidle");
  ok("ajout au panier", (await page.getByTestId("cart-lines").textContent()).includes("140"));
  await page.getByTestId("cart-quote").click();
  await page.waitForURL(/\/devis\?panier=1/);
  await page.waitForTimeout(600);
  ok("devis pré-rempli depuis le panier", (await page.getByTestId("quote-product-select").first().inputValue()) === "CF-EI60-140-2V");
}

/* ---------- Pages catégorie ---------- */
for (const slug of ["portes-coupe-feu", "portes-galandage", "incendie"]) {
  await page.goto(BASE + `/produits/${slug}`);
  const h1 = (await page.getByTestId("category-h1").textContent()).trim();
  const html = await page.content();
  ok(`catégorie ${slug} : H1 mot-clé + ville, FAQ, JSON-LD FAQPage`, /Casablanca|Maroc/.test(h1) && (await page.getByTestId("category-faq").count()) > 0 && html.includes("FAQPage"), h1);
}

/* ---------- Demandes de devis : créées « à valider », rien pour le client avant validation ---------- */
const PENDING_MSG = "Votre demande de devis est enregistrée, notre équipe la valide et vous l'envoie très vite.";
const before = { n: counter(), rows: journalRows().length, pdf: pdfs().length };
const db = (sql) => execFileSync("python3", ["-c", "import sqlite3,sys,json;c=sqlite3.connect(sys.argv[1]);print(json.dumps(c.execute(sys.argv[2]).fetchall()))", "/tmp/faw-devis-test/faw-test.db", sql], { encoding: "utf8" });
const quoteRow = (token) => JSON.parse(db(`select q.id,q.status,q.number,q.pdfFile,o.status from Quote q left join "Order" o on o.id=q.orderId where q.token='${token.replace(/[^\w-]/g, "")}'`))[0] ?? [];
async function submitPending(name) {
  await page.waitForURL(/\/devis\/confirmation\//, { timeout: 60_000 });
  const token = page.url().split("/").pop();
  const msg = (await page.getByTestId("quote-pending").textContent()).trim();
  ok(`${name} : message « demande enregistrée » exact`, msg === PENDING_MSG, msg);
  ok(`${name} : aucun numéro ni PDF côté client`, (await page.getByTestId("quote-number").count()) === 0 && (await page.getByTestId("quote-download").count()) === 0 && !/\/devis\/pdf\//.test(await page.content()));
  ok(`${name} : PDF public introuvable (404) avant validation`, (await fetch(`${BASE}/devis/pdf/${token}?dl=1`)).status === 404);
  const [, status, number] = quoteRow(token);
  ok(`${name} : devis « à valider », sans numéro`, status === "à valider" && number == null, `${status} ${number}`);
  const sv = await suivi(token);
  ok(`${name} : page privée /devis/suivi « en cours de validation », sans numéro ni PDF`, sv.status === 200 && sv.state === "en-cours" && sv.html.includes("en cours de validation") && !/\/devis\/pdf\//.test(sv.html), `${sv.status} ${sv.state}`);
  ok(`${name} : lien privé affiché + consigne de le conserver`, (await page.getByTestId("quote-private-link").inputValue()).endsWith(`/devis/suivi/${token}`) && (await page.getByTestId("quote-keep-link").count()) === 1);
  return token;
}
let quote1 = {};
{
  await page.goto(BASE + "/devis?ref=CF-EI60-90&qte=4");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  ok("formulaire compact : ≤ 6 champs visibles", (await page.locator('[data-testid="quote-form"] input:visible:not([type=hidden]):not([type=checkbox])').count()) <= 6);
  ok("estimation palier 4 portes = 8 000 DH", /8\s?000/.test((await page.getByTestId("quote-estimate").textContent()).replace(/\u202f|\u00a0/g, " ")));
  await page.fill("#name", "Test E2E Particulier");
  await page.fill("#phone", `66${rnd}1`.slice(0, 9));
  await page.fill("#city", "Casablanca");
  await sleep(900);
  await page.getByTestId("quote-submit").click();
  quote1.token = await submitPending("demande particulier");
  await page.screenshot({ path: OUT + "quote-confirmation.png", fullPage: true });
  ok("lien WhatsApp présent", /wa\.me\/212660121813/.test((await page.getByTestId("quote-confirm-wa").getAttribute("href")) ?? ""));
}

let quote2 = {};
{
  await page.goto(BASE + "/devis?ref=EXT-PABC-6&qte=2");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("quote-type-entreprise").click();
  await page.fill("#name", "Responsable Achat");
  await page.fill("#phone", `07${rnd}12`.slice(0, 10));
  await page.fill("#city", "Rabat");
  await sleep(900);
  await page.getByTestId("quote-submit").click();
  await page.waitForTimeout(1500);
  ok("entreprise : raison sociale obligatoire", page.url().includes("/devis?") && (await page.locator("#company[aria-invalid=true]").count()) === 1);
  await page.fill("#company", "SOCIETE TEST E2E SARL");
  await page.fill("#ice", "001234567000089");
  await page.fill("#email", "achat@example.com");
  await page.getByTestId("quote-submit").click();
  quote2.token = await submitPending("demande entreprise");
}

let quote3 = {};
{
  await page.goto(BASE + "/devis?ref=EXT-PABC-6&qte=1");
  await page.waitForLoadState("networkidle");
  await page.fill("#name", "Test E2E A Refuser");
  await page.fill("#phone", `06${rnd}33`.slice(0, 10));
  await page.fill("#city", "Casablanca");
  await sleep(900);
  await page.getByTestId("quote-submit").click();
  quote3.token = await submitPending("demande à refuser");
}
let quote4 = {};
{
  await page.goto(BASE + "/devis?ref=EXT-PABC-6&qte=1");
  await page.waitForLoadState("networkidle");
  await page.fill("#name", "Test E2E Echec <b>Email</b>");
  await page.fill("#phone", `06${rnd}44`.slice(0, 10));
  await page.fill("#city", "Casablanca");
  await page.fill("#email", "echec@example.com");
  await sleep(900);
  await page.getByTestId("quote-submit").click();
  quote4.token = await submitPending("demande avec e-mail (échec simulé)");
}
ok("demandes : aucun e-mail envoyé à la soumission du formulaire", mail.reqs.length === 0, String(mail.reqs.length));
ok("demandes : aucun numéro consommé, aucun PDF, journal de test inchangé", counter() === before.n && pdfs().length === before.pdf && journalRows().length === before.rows, `${counter()} ${pdfs().length} ${journalRows().length}`);

/* ---------- Refus automatique : galandage stock à confirmer + demande de remise ---------- */
{
  const n0 = counter(), p0 = pdfs().length, j0 = journalRows().length;
  await page.goto(BASE + "/devis?ref=GAL-800&qte=1");
  await page.waitForLoadState("networkidle");
  const phone = `06${rnd}77`.slice(0, 10);
  await page.fill("#name", "Test Refus E2E");
  await page.fill("#phone", phone);
  await page.fill("#city", "Marrakech");
  await page.getByText("Une précision ?").click();
  await page.fill("#note", "Possible d'avoir une remise ?");
  await sleep(900);
  await page.getByTestId("quote-submit").click();
  await page.getByTestId("quote-refused").waitFor({ timeout: 30_000 });
  ok("refus : message aimable + WhatsApp", /wa\.me\/212660121813/.test(await page.getByTestId("quote-refused-wa").getAttribute("href")));
  ok("refus : aucun numéro consommé, aucun PDF, journal inchangé", counter() === n0 && pdfs().length === p0 && journalRows().length === j0);
  globalThis.refusedPhone = phone;
}

/* ---------- Honeypot ---------- */
{
  const n0 = counter();
  await page.goto(BASE + "/devis?ref=EXT-PABC-6&qte=1");
  await page.waitForLoadState("networkidle");
  await page.fill("#name", "Robot");
  await page.fill("#phone", "0612345678");
  await page.fill("#city", "Casablanca");
  await page.evaluate(() => { const i = document.querySelector('input[name="website"]'); i.value = "http://spam.example"; });
  await sleep(900);
  await page.getByTestId("quote-submit").click();
  await page.waitForTimeout(2500);
  ok("honeypot : rejeté, pas de devis", !page.url().includes("/confirmation/") && counter() === n0);
}

/* ---------- Liens privés : jetons, 404 sans fuite, en-têtes ---------- */
{
  const tok = quote2.token;
  ok("jeton du devis : 32 caractères base64url (192 bits)", /^[\w-]{32}$/.test(tok), String(tok.length));
  const sv = await suivi(tok);
  const cc = sv.headers.get("cache-control") ?? "", xr = sv.headers.get("x-robots-tag") ?? "";
  ok("page privée : no-store + noindex (en-tête et meta) + no-referrer", /no-store/.test(cc) && /noindex/.test(xr) && /<meta name="robots" content="[^"]*noindex/.test(sv.html) && sv.headers.get("referrer-policy") === "no-referrer", `${cc} | ${xr}`);
  const flip = tok.slice(0, -1) + (tok.at(-1) === "A" ? "B" : "A");
  const bad = ["abc", "x".repeat(32), flip, tok + "x", tok.slice(1), "A".repeat(31) + "~"];
  const leaks = [];
  for (const t of bad) {
    for (const u of [`/devis/suivi/${t}`, `/devis/pdf/${t}`, `/devis/confirmation/${t}`]) {
      const r = await fetch(BASE + u);
      const body = await r.text();
      if (r.status !== 404 || /Test E2E|SOCIETE TEST|Responsable Achat|example\.com/.test(body)) leaks.push(`${u}:${r.status}`);
    }
  }
  ok("mauvais jeton : 404 sans aucune donnée client (suivi, pdf, confirmation)", leaks.length === 0, leaks.join(" "));
  const byNum = await Promise.all(["/devis/pdf/9001", "/devis/pdf/1", "/devis/suivi/9001"].map((u) => fetch(BASE + u).then((r) => r.status)));
  ok("aucun accès par numéro ou id (404)", byNum.every((x) => x === 404), byNum.join(","));
  // Limitation de débit : IP fictive (X-Forwarded-For), limite de test 80 / 10 min
  let first429 = 0;
  for (let i = 1; i <= 85 && !first429; i++) {
    const r = await fetch(`${BASE}/devis/suivi/${"z".repeat(32)}`, { headers: { "x-forwarded-for": `203.0.113.${rnd % 250}` } });
    if (r.status === 429) first429 = i;
  }
  ok("liens privés : limitation de débit (429 après 80 requêtes)", first429 === 81, String(first429));
  const p = await newPage();
  await p.goto(`${BASE}/devis/suivi/${tok}`);
  await p.screenshot({ path: SHOTS + "devis-suivi-avant.png", fullPage: true });
  await p.context().close();
}

/* ---------- Admin : connexion, refus visible, Stock, Devis ---------- */
const admin = await newPage();
{
  await admin.goto(BASE + "/admin");
  await admin.fill("#password", env.ADMIN_PASSWORD);
  await admin.getByRole("button", { name: /connexion|se connecter|entrer/i }).click();
  await admin.waitForLoadState("networkidle");
  const cookies = await admin.context().cookies();
  const c = cookies.find((x) => x.name === "faw-admin");
  ok("cookie admin httpOnly + SameSite=Strict + expiration", c && c.httpOnly && c.sameSite === "Strict" && c.expires > Date.now() / 1000);

  await admin.goto(BASE + "/admin/commandes?refus=1");
  const refusal = admin.locator('[data-testid="order-row"]', { hasText: "Test Refus E2E" });
  ok("refus : lead visible dans l'admin avec motif", (await refusal.count()) >= 1 && /confirm|remise/i.test(await refusal.first().getByTestId("quote-refusal").textContent()));

  /* ----- Admin > Devis : validation par l'équipe ----- */
  await admin.goto(BASE + "/admin");
  const badge = Number((await admin.getByTestId("nav-devis-badge").textContent()).trim());
  ok("badge « à valider » dans le menu et carte tableau de bord", badge >= 3 && Number((await admin.getByTestId("dash-devis-a-valider").textContent()).match(/\d+\s*$/)?.[0]) === badge, String(badge));
  await admin.goto(BASE + "/admin/devis?statut=" + encodeURIComponent("à valider"));
  const table = await admin.getByTestId("devis-table").textContent();
  ok("admin Devis : e-mail automatique activé (configuration de test)", /activé/.test(await admin.getByTestId("devis-email-config").textContent()));
  ok("admin Devis : filtre « à valider » liste les 4 demandes", ["Test E2E Particulier", "SOCIETE TEST E2E SARL", "Test E2E A Refuser", "Test E2E Echec"].every((n) => table.includes(n)) && (await admin.locator('[data-testid="devis-row"]:not([data-status="à valider"])').count()) === 0);
  const idOf = (t) => quoteRow(t)[0];
  for (const q of [quote1, quote2, quote3, quote4]) q.id = idOf(q.token);

  // Brouillon : admin seulement, marqué BROUILLON, sans numéro
  await admin.goto(`${BASE}/admin/devis/${quote1.id}`);
  await admin.getByTestId("devis-preview").waitFor();
  ok("détail : aperçu brouillon (PNG) chargé", await admin.getByTestId("devis-preview").evaluate((img) => img.complete && img.naturalWidth > 300));
  const br = await admin.request.get(`${BASE}/admin/devis/${quote1.id}/brouillon`);
  fs.writeFileSync(OUT + "brouillon.pdf", await br.body());
  const brTxt = execFileSync("pdftotext", ["-layout", OUT + "brouillon.pdf", "-"], { encoding: "utf8" });
  ok("brouillon : PDF marqué BROUILLON, non validé, sans numéro", br.status() === 200 && /BROUILLON/.test(brTxt) && /non validé/.test(brTxt) && !/\b9\d{3}\b/.test(brTxt.replace(/\d{1,3}(\.\d{3})+,\d\d/g, "").replace(/RAL \d{4}/g, "")));
  ok("brouillon refusé sans session (401)", (await fetch(`${BASE}/admin/devis/${quote1.id}/brouillon?format=png`)).status === 401);
  ok("brouillon : compteur de test inchangé", counter() === before.n);
  {
    const anon = async (u) => (await fetch(BASE + u)).text();
    const [l, dt, st] = await Promise.all([anon("/admin/devis"), anon(`/admin/devis/${quote1.id}`), anon("/admin/stock")]);
    ok("admin sans session : aucune donnée devis/stock dans la page (ni HTML ni payload)",
      !/devis-tabs|devis-detail|Test E2E Particulier/.test(l + dt) && !/stock-qty|stock-price/.test(st) && /id="password"/.test(l), "");
  }
  await admin.getByTestId("devis-valider").waitFor();

  // Valider → numéro du compteur de TEST + PDF définitif
  await admin.getByTestId("devis-valider").click();
  await admin.getByTestId("devis-marquer-envoye").waitFor({ timeout: 60_000 });
  const num = (await admin.getByTestId("devis-number").textContent()).trim();
  quote1.num = num;
  ok("Valider : numéro issu du compteur de TEST", Number(num) === before.n + 1 && Number(num) > 9000 && counter() === before.n + 1, num);
  ok("Valider : journal de test toujours inchangé (pas encore envoyé)", journalRows().length === before.rows);
  ok("téléphone seul : aucun e-mail envoyé", mail.reqs.length === 0, String(mail.reqs.length));
  ok("téléphone seul : panneau e-mail « aucune adresse »", /aucune/.test(await admin.getByTestId("devis-email-to").textContent()) && (await admin.getByTestId("devis-email-resend").count()) === 0);
  {
    const sv = await suivi(quote1.token);
    ok("Valider : lien privé débloqué (numéro, total, PDF)", sv.state === "valide" && sv.html.includes(num) && sv.html.includes(`/devis/pdf/${quote1.token}`), sv.state);
    const pr = await fetch(`${BASE}/devis/pdf/${quote1.token}`);
    ok("Valider : PDF client disponible via le jeton (200, no-store)", pr.status === 200 && pr.headers.get("content-type") === "application/pdf" && /no-store/.test(pr.headers.get("cache-control") ?? ""));
  }
  const r = await admin.request.get(BASE + (await admin.getByTestId("devis-final-download").getAttribute("href")));
  const f = `${OUT}devis-particulier-${num}.pdf`;
  fs.writeFileSync(f, await r.body());
  const txt = execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8" });
  quote1.file = f;
  ok("PDF définitif téléchargeable (application/pdf), numéroté", r.status() === 200 && r.headers()["content-type"] === "application/pdf" && txt.includes(num) && !/BROUILLON/.test(txt));
  ok("PDF : Fourniture seule, installation non incluse", /Fourniture seule, installation non incluse/.test(txt));
  ok("PDF : TVA 20 %, HT et TTC", /TVA 20/.test(txt) && /HT/.test(txt) && /TTC/.test(txt));
  ok("PDF : validité 14 jours, virement ou chèque", /14 jours/.test(txt) && /virement/i.test(txt) && /ch[èe]que/i.test(txt));
  ok("PDF : transport Casablanca 400 DH en option hors total", /400/.test(txt) && /non incluse? dans le total|hors total/i.test(txt));
  ok("PDF : aucune mention interdite", !FORBIDDEN.test(txt), txt.match(FORBIDDEN)?.[0]);
  ok("PDF : prix palier 2 000 DH × 4", /2\.000,00/.test(txt) && /8\.000,00/.test(txt));
  ok("PDF admin refusé sans session (401)", (await fetch(`${BASE}/admin/devis/${quote1.id}/pdf`)).status === 401);

  // Envoyer au client : rien d'automatique, message + wa.me prêts, puis « Marquer comme envoyé »
  const waMsg = (await admin.getByTestId("devis-wa-message").textContent()).replace(/\u202f|\u00a0/g, " ");
  const waHref = await admin.getByTestId("devis-wa-link").getAttribute("href");
  ok("Envoyer : message WhatsApp prêt (total) + lien wa.me vers le client", /8 000/.test(waMsg) && waHref.startsWith("https://wa.me/2126") && waHref.includes("text="), waHref.slice(0, 40));
  ok("Envoyer : message et lien wa.me contiennent le lien privé", waMsg.includes(`/devis/suivi/${quote1.token}`) && decodeURIComponent(waHref).includes(`/devis/suivi/${quote1.token}`));
  await admin.screenshot({ path: OUT + "admin-devis-valide.png", fullPage: true });
  await admin.getByTestId("devis-marquer-envoye").click();
  await admin.locator('[data-testid="devis-detail"][data-status="envoyé"]').waitFor({ timeout: 30_000 });
  const rows = journalRows();
  const last = rows.at(-1) ?? "";
  ok("Marquer envoyé : une ligne au journal de TEST (numéro, validé par l'équipe, WhatsApp)", rows.length === before.rows + 1 && last.startsWith(num + ",") && /validé par l'équipe/.test(last) && /WhatsApp/.test(last) && /8000/.test(last), last.slice(0, 200));
  const [, st1, , , orderSt] = quoteRow(quote1.token);
  ok("Marquer envoyé : devis « envoyé », demande « devis envoyé »", st1 === "envoyé" && orderSt === "devis envoyé", `${st1} / ${orderSt}`);
  const pubPdf = await fetch(`${BASE}/devis/pdf/${quote1.token}?dl=1`);
  ok("après envoi : le client peut télécharger son PDF", pubPdf.status === 200 && pubPdf.headers.get("content-type") === "application/pdf");

  // Entreprise : modification de quantité avant validation, puis validation
  await admin.goto(`${BASE}/admin/devis/${quote2.id}`);
  await admin.getByTestId("devis-qty").first().fill("3");
  await admin.getByTestId("devis-qty-save").click();
  await admin.getByTestId("devis-qty-msg").waitFor();
  ok("quantités modifiables avant validation (2 → 3)", /enregistr/i.test(await admin.getByTestId("devis-qty-msg").textContent()), await admin.getByTestId("devis-qty-msg").textContent());
  // Deuxième onglet ouvert sur le même devis (validation concurrente)
  const tabB = await admin.context().newPage();
  await tabB.goto(`${BASE}/admin/devis/${quote2.id}`);
  await tabB.getByTestId("devis-valider").waitFor();
  ok("à valider : l'aide du bouton annonce l'envoi par e-mail", /e-mail \(achat@example\.com\)/.test(await admin.getByTestId("devis-valider-hint").textContent()));
  await admin.getByTestId("devis-valider").click();
  await admin.locator('[data-testid="devis-detail"][data-status="envoyé"]').waitFor({ timeout: 60_000 });
  quote2.num = (await admin.getByTestId("devis-number").textContent()).trim();
  {
    const r = mail.reqs[0] ?? { body: {} };
    const b = r.body;
    const link = `/devis/suivi/${quote2.token}`;
    ok("Valider (avec e-mail) : exactement 1 requête Resend", mail.reqs.length === 1, String(mail.reqs.length));
    ok("e-mail : destinataire = le client uniquement, sans copie", JSON.stringify(b.to) === JSON.stringify(["achat@example.com"]) && !b.cc && !b.bcc, JSON.stringify(b.to));
    ok("e-mail : clé API + Idempotency-Key + expéditeur/répondre à", r.auth === "Bearer re_test_dummy" && /^faw-devis-\d+-\d+-1$/.test(r.idem ?? "") && b.from === "FAW Test <devis@example.test>" && b.reply_to === "faw@faw.ma", `${r.idem}`);
    ok("e-mail : objet + numéro + total + lien privé (texte et HTML)", b.subject?.includes(quote2.num) && b.text?.includes(link) && b.html?.includes(link) && /TTC/.test(b.text ?? "") && /FAW Aluminium/.test(b.text ?? ""), b.subject);
    ok("e-mail : PDF joint (application/pdf base64)", b.attachments?.length === 1 && b.attachments[0].filename.endsWith(".pdf") && Buffer.from(b.attachments[0].content, "base64").subarray(0, 5).toString() === "%PDF-");
    ok("e-mail : pas de pixel de suivi ni de mention interdite", !/<img/i.test(b.html ?? "") && !FORBIDDEN.test((b.text ?? "") + (b.html ?? "")));
    const rows = journalRows();
    ok("e-mail envoyé : devis « envoyé » + une ligne au journal de TEST (e-mail)", quoteRow(quote2.token)[1] === "envoyé" && rows.length === before.rows + 2 && rows.at(-1).startsWith(quote2.num + ",") && /e-mail/.test(rows.at(-1)), rows.at(-1)?.slice(0, 160));
    ok("admin : statut « Envoyé le … (id mock-1) »", /Envoyé le .*mock-1/.test(await admin.getByTestId("devis-email-status").textContent()));
    const sv = await suivi(quote2.token);
    ok("client : page privée débloquée après Valider", sv.state === "valide" && sv.html.includes(quote2.num));
    const p = await newPage();
    await p.goto(`${BASE}/devis/suivi/${quote2.token}`);
    await p.screenshot({ path: SHOTS + "devis-suivi-apres.png", fullPage: true });
    await p.context().close();
  }
  // Valider une 2e fois depuis l'onglet resté ouvert : refusé, aucun nouvel e-mail, aucun numéro
  {
    const n = counter(), j = journalRows().length;
    await tabB.getByTestId("devis-valider").click();
    await tabB.waitForTimeout(3000);
    ok("2e « Valider » (autre onglet) : aucun nouvel e-mail, numéro ni ligne de journal", mail.reqs.length === 1 && counter() === n && journalRows().length === j, `${mail.reqs.length} ${counter()} ${journalRows().length}`);
    await tabB.close();
  }
  // Renvoyer l'email : un envoi par clic, pas de nouvelle ligne de journal
  {
    await sleep(4500);
    const j = journalRows().length;
    await admin.getByTestId("devis-email-resend").click();
    await admin.waitForFunction(() => /envoyé au client/.test(document.querySelector('[data-testid="devis-email-resend-msg"]')?.textContent ?? ""), null, { timeout: 30_000 });
    ok("Renvoyer l'email : 2e requête Resend, même destinataire, nouvelle clé", mail.reqs.length === 2 && mail.reqs[1].body.to?.[0] === "achat@example.com" && /-2$/.test(mail.reqs[1].idem ?? ""), String(mail.reqs.length));
    ok("Renvoyer l'email : pas de nouvelle ligne au journal", journalRows().length === j);
    await admin.getByTestId("devis-email-resend").click();
    await admin.waitForFunction(() => /patientez/.test(document.querySelector('[data-testid="devis-email-resend-msg"]')?.textContent ?? ""), null, { timeout: 30_000 });
    ok("Renvoyer l'email : double clic immédiat refusé (anti double envoi)", mail.reqs.length === 2);
    await admin.getByTestId("devis-email-panel").scrollIntoViewIfNeeded();
    await admin.screenshot({ path: SHOTS + "admin-devis-email.png", fullPage: true });
  }
  const r2 = await admin.request.get(BASE + (await admin.getByTestId("devis-final-download").getAttribute("href")));
  const f2 = `${OUT}devis-entreprise-${quote2.num}.pdf`;
  fs.writeFileSync(f2, await r2.body());
  const txt2 = execFileSync("pdftotext", ["-layout", f2, "-"], { encoding: "utf8" });
  quote2.file = f2;
  ok("entreprise : numéro suivant du compteur de test", Number(quote2.num) === before.n + 2, quote2.num);
  ok("PDF entreprise : raison sociale + ICE, quantité 3", txt2.includes("SOCIETE TEST E2E SARL") && txt2.includes("001234567000089") && /\b3\b/.test(txt2));
  ok("PDF entreprise : Rabat 800 DH en option, mentions obligatoires", /800/.test(txt2) && /Fourniture seule, installation non incluse/.test(txt2) && !FORBIDDEN.test(txt2));

  // Échec Resend (500) : la validation passe, l'erreur est affichée, pas de journal ; puis « Renvoyer » réussit
  {
    mail.mode = "500";
    const j = journalRows().length, n0 = mail.reqs.length;
    await admin.goto(`${BASE}/admin/devis/${quote4.id}`);
    await admin.getByTestId("devis-valider").click();
    await admin.getByTestId("devis-email-error").waitFor({ timeout: 60_000 });
    quote4.num = (await admin.getByTestId("devis-number").textContent()).trim();
    const err = await admin.getByTestId("devis-email-error").textContent();
    ok("échec Resend : devis quand même validé et numéroté", quoteRow(quote4.token)[1] === "validé" && Number(quote4.num) === before.n + 3, `${quoteRow(quote4.token)[1]} ${quote4.num}`);
    ok("échec Resend : 1 tentative, erreur affichée dans l'admin", mail.reqs.length === n0 + 1 && /500/.test(err) && /panne simulée/.test(err), err);
    ok("échec Resend : aucune ligne au journal", journalRows().length === j);
    ok("échec Resend : le client voit quand même son devis via le lien privé", (await suivi(quote4.token)).state === "valide");
    ok("e-mail : champs du client échappés dans le HTML", /Test E2E Echec &lt;b&gt;Email&lt;\/b&gt;/.test(mail.reqs.at(-1).body.html ?? "") && !/<b>Email<\/b>/.test(mail.reqs.at(-1).body.html ?? ""));
    await admin.getByTestId("devis-email-panel").scrollIntoViewIfNeeded();
    await admin.screenshot({ path: SHOTS + "admin-devis-email-erreur.png", fullPage: true });
    mail.mode = "ok";
    await sleep(4500);
    await admin.getByTestId("devis-email-resend").click();
    await admin.locator('[data-testid="devis-detail"][data-status="envoyé"]').waitFor({ timeout: 30_000 });
    const rows = journalRows();
    ok("après échec, « Renvoyer l'email » : envoyé + une ligne au journal", mail.reqs.length === n0 + 2 && rows.length === j + 1 && rows.at(-1).startsWith(quote4.num + ",") && quoteRow(quote4.token)[1] === "envoyé");
  }

  // Refuser / annuler : aucun numéro consommé
  const n3 = counter();
  await admin.goto(`${BASE}/admin/devis/${quote3.id}`);
  await admin.getByTestId("devis-refuser").click();
  await admin.getByTestId("devis-refus-motif").fill("Doublon de test e2e");
  await admin.getByTestId("devis-refus-confirmer").click();
  await admin.locator('[data-testid="devis-detail"][data-status="refusé"]').waitFor({ timeout: 30_000 });
  ok("Refuser : statut refusé, motif, aucun numéro consommé", quoteRow(quote3.token)[1] === "refusé" && counter() === n3 && /Doublon/.test(await admin.getByTestId("devis-refus-info").textContent()));
  ok("Refuser : PDF client toujours 404", (await fetch(`${BASE}/devis/pdf/${quote3.token}`)).status === 404);

  // Ajout produit avec photo et variantes
  await admin.goto(BASE + "/admin/stock");
  const ref = `TEST-E2E-${rnd}`;
  await admin.fill("#np-title", "Produit test e2e");
  await admin.fill("#np-id", ref);
  await admin.selectOption("#np-category", { index: 3 });
  await admin.fill("#np-price", "1234");
  await admin.setInputFiles("#np-photo", ROOT + "public/images/products/EXT-PABC-6.jpg");
  await admin.fill("#np-description", "Produit créé par le test automatique, à masquer après le test.");
  await admin.fill("#np-variants", "6 kg ; 1234\n9 kg ; 1500");
  await admin.getByTestId("new-product-submit").click();
  await admin.getByTestId("new-product-status").waitFor();
  const st = await admin.getByTestId("new-product-status").textContent();
  ok("admin Stock : ajout produit (photo + 2 tailles)", /2 fiches créées/.test(st), st);
  // mot interdit refusé
  await admin.fill("#np-title", "Porte de secours test");
  await admin.fill("#np-id", `${ref}-X`);
  await admin.fill("#np-price", "100");
  await admin.fill("#np-description", "Description assez longue pour passer la validation.");
  await admin.fill("#np-variants", "");
  await admin.getByTestId("new-product-submit").click();
  await admin.waitForFunction(() => /refusé/.test(document.querySelector('[data-testid="new-product-status"]')?.textContent ?? ""));
  ok("admin Stock : mot interdit refusé", true);

  const pub = await (await fetch(BASE + `/produits/produit-test-e2e-6-kg`)).text();
  const imgOk = /(\/|%2F)media(\/|%2F)[0-9a-f-]{36}\.webp/.test(pub);
  ok("nouveau produit visible + photo ré-encodée servie", imgOk);
  // Restauration : masquer les fiches de test (aucune suppression)
  await admin.goto(BASE + "/admin/stock");
  await admin.screenshot({ path: OUT + "stock-before-restore.png", fullPage: true });
  for (const id of [`${ref}-6-KG`, `${ref}-9-KG`]) {
    const row = admin.getByTestId(`stock-row-${id}`);
    await row.getByTestId("stock-active").uncheck();
    await row.getByTestId("stock-save").click();
    await row.getByText("Enregistré").waitFor();
  }
  ok("produit de test masqué (restauré, non supprimé)", (await fetch(BASE + `/produits/produit-test-e2e-6-kg`)).status === 404);

  // Stock 0 → bouton désactivé + JSON-LD OutOfStock, puis restauration
  const row = admin.getByTestId("stock-row-EXT-CO2-5");
  await row.getByTestId("stock-qty").fill("0");
  await row.getByTestId("stock-save").click();
  await row.getByText("Enregistré").waitFor();
  const shop = await newPage();
  await shop.goto(BASE + "/produits/ext-co2-5");
  const disabled = await shop.getByTestId("add-to-cart").isDisabled();
  const ld0 = await shop.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent).join(""));
  ok("stock 0 : bouton désactivé + JSON-LD OutOfStock", disabled && ld0.includes("OutOfStock") && !ld0.includes("InStock"));
  await row.getByTestId("stock-qty").fill("");
  await row.getByTestId("stock-save").click();
  await row.getByText("Enregistré").waitFor();
  await shop.goto(BASE + "/produits/ext-co2-5");
  const ld1 = await shop.$$eval('script[type="application/ld+json"]', (s) => s.map((x) => x.textContent).join(""));
  ok("stock restauré : bouton actif + InStock", !(await shop.getByTestId("add-to-cart").isDisabled()) && ld1.includes("InStock"));
  await shop.context().close();
}

/* ---------- Bot (mobile) ---------- */
{
  const m = await newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.goto(BASE + "/");
  await m.waitForLoadState("networkidle");
  const wa = await m.locator('a[href*="wa.me"]').filter({ has: m.locator("svg") }).last().boundingBox();
  const tg = await m.getByTestId("bot-toggle").boundingBox();
  const overlap = wa && tg && !(tg.y + tg.height <= wa.y || wa.y + wa.height <= tg.y || tg.x + tg.width <= wa.x || wa.x + wa.width <= tg.x);
  ok("bot : bouton ne recouvre pas WhatsApp", !overlap, JSON.stringify({ wa, tg }));
  await m.getByTestId("bot-toggle").click();
  await m.getByTestId("bot-taille").click();
  ok("bot : tailles avec prix réels", /2\s?200/.test((await m.getByTestId("bot-panel").textContent()).replace(/\u202f|\u00a0/g, " ")));
  await m.getByTestId("bot-back").click();
  await m.getByTestId("bot-walfar").click();
  await m.locator('[data-testid="bot-form"] input[name="name"]').fill("Test Bot E2E");
  await m.locator('[data-testid="bot-form"] input[name="phone"]').fill(`06${rnd}55`.slice(0, 10));
  await sleep(900);
  await m.getByTestId("bot-submit").click();
  const href = await m.getByTestId("bot-wa-link").getAttribute("href", { timeout: 15_000 });
  ok("bot : se termine par un lien WhatsApp vers Walfar", /^https:\/\/wa\.me\/212660121813/.test(href ?? ""), href);
  await m.screenshot({ path: OUT + "bot-mobile.png" });
  await m.context().close();
  await admin.goto(BASE + "/admin/clients?q=Test%20Bot");
  ok("bot : lead dans le CRM (source bot)", (await admin.content()).includes("Test Bot E2E"));
}

/* ---------- Responsive 390 / 1440, sombre, arabe ---------- */
{
  const pages = ["/", "/produits/portes-coupe-feu", "/produits/cf-ei60-90", "/devis", "/panier", "/livraison"];
  for (const w of [390, 1440]) {
    const p = await newPage({ viewport: { width: w, height: 900 } });
    const bad = [];
    for (const u of pages) {
      await p.goto(BASE + u);
      await p.waitForLoadState("networkidle");
      const o = await overflowX(p);
      if (o > 0) bad.push(`${u}:${o}`);
    }
    ok(`pas de débordement horizontal à ${w}px`, bad.length === 0, bad.join(" "));
    if (w === 390) {
      await p.goto(BASE + "/produits/cf-ei60-90");
      await p.getByTestId("theme-toggle").click();
      ok("mode sombre", await p.evaluate(() => document.documentElement.classList.contains("dark")));
      // Sur mobile, le choix de langue est dans le menu.
      await p.locator("header button[aria-expanded]").click();
      await p.locator('[data-testid="locale-toggle"]:visible').click();
      await p.waitForFunction(() => document.documentElement.dir === "rtl");
      await p.waitForLoadState("networkidle");
      await p.keyboard.press("Escape");
      ok("arabe RTL + pas de débordement", (await overflowX(p)) <= 0);
      await p.screenshot({ path: OUT + "product-ar-dark-390.png", fullPage: false });
      await p.locator("header button[aria-expanded]").click();
      await p.locator('[data-testid="locale-toggle"]:visible').click();
      await p.waitForFunction(() => document.documentElement.dir === "ltr");
    }
    await p.context().close();
  }
  const adm = admin;
  await adm.setViewportSize({ width: 390, height: 844 });
  await adm.goto(BASE + "/admin/stock");
  // body est en overflow-x: clip : on vérifie que la page ne défile pas horizontalement (les tableaux défilent dans leur cadre).
  const admX = await adm.evaluate(() => { scrollTo(5000, 0); const x = scrollX; scrollTo(0, 0); return x; });
  ok("admin Stock : pas de défilement horizontal de la page à 390px (tableaux défilants)", admX === 0, String(admX));
}

/* ---------- Verrouillage de connexion (en dernier : bloque l'IP de test 1 min) ---------- */
{
  const l = await newPage();
  let msg = "";
  for (let i = 0; i < 6; i++) {
    await l.goto(BASE + "/admin");
    await l.fill("#password", "mauvais-mot-de-passe-" + i);
    await l.getByRole("button", { name: /connexion|se connecter|entrer/i }).click();
    await l.waitForTimeout(700);
    msg = (await l.locator("[role=alert]").allTextContents()).join(" ");
  }
  ok("verrouillage après échecs répétés", /Trop de tentatives/.test(msg), msg);
  await l.fill("#password", env.ADMIN_PASSWORD);
  await l.getByRole("button", { name: /connexion|se connecter|entrer/i }).click();
  await l.waitForTimeout(800);
  ok("verrouillé même avec le bon mot de passe", /Trop de tentatives/.test((await l.locator("[role=alert]").allTextContents()).join(" ")));
}

/* ---------- Le compteur et le journal réels n'ont pas bougé ---------- */
const realAfter = [sha(`${REAL}/compteur-devis.txt`), sha(`${REAL}/journal-devis.csv`)];
ok("compteur et journal RÉELS inchangés (sha256)", realBefore[0] === realAfter[0] && realBefore[1] === realAfter[1]);
ok("pas d'erreur JS", consoleErrors.length === 0, consoleErrors.slice(0, 5).join(" | "));

await browser.close();
mock.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(OUT + "results.json", JSON.stringify({ results, quote1: { num: quote1.num, file: quote1.file }, quote2: { num: quote2.num, file: quote2.file } }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
