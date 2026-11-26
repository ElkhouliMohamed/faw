import "server-only";
import { DEFAULT_SHIPPING, type ShippingConfig } from "./delivery";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { appendFile, mkdir, mkdtemp, open, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { categoryKey, effectiveAvailability, type Product } from "./products";

const run = promisify(execFile);

/* ------------------------------------------------------------------ *
 * Configuration (100 % variables d'environnement)
 *  - PYTHON_BIN               : python3 par défaut
 *  - DEVIS_GENERATOR_SCRIPT   : chemin de generer_devis.py
 *  - DEVIS_COUNTER_SCRIPT     : chemin de prochain_numero.py (seule source des numéros)
 *  - DEVIS_JOURNAL_PATH       : journal-devis.csv (ajout d'une ligne par devis généré)
 *  - DEVIS_MESSAGE_PATH       : message-devis.md (facultatif, modèle WhatsApp)
 *  - DEVIS_OUTPUT_DIR         : dossier des PDF (défaut data/devis)
 *  - FAW_TEST=1               : refuse tout chemin hors /tmp (tests : jamais le vrai compteur ni le vrai journal)
 * ------------------------------------------------------------------ */
export type DevisConfig = { python: string; generator: string; counter: string; journal: string; message?: string; outDir: string };

export function devisConfig(): DevisConfig | null {
  const e = process.env;
  const generator = e.DEVIS_GENERATOR_SCRIPT?.trim();
  const counter = e.DEVIS_COUNTER_SCRIPT?.trim();
  const journal = e.DEVIS_JOURNAL_PATH?.trim();
  if (!generator || !counter || !journal) return null;
  const cfg: DevisConfig = {
    python: e.PYTHON_BIN?.trim() || "python3",
    generator,
    counter,
    journal,
    message: e.DEVIS_MESSAGE_PATH?.trim() || path.join(path.dirname(generator), "message-devis.md"),
    outDir: devisOutDir(),
  };
  if (e.FAW_TEST === "1" && ![cfg.generator, cfg.counter, cfg.journal].every((p) => path.resolve(p).startsWith("/tmp/"))) return null;
  return cfg;
}

/* ---------------------------- Règles ---------------------------- */
export const DOOR_TIER = { min: 4, price: 2000, ids: ["CF-EI60-80", "CF-EI60-90", "CF-EI60-100"] } as const;
const KIT_MAX_LEAF_M = 2.5;
const DISCOUNT_RE = /\b(remise|r[ée]duc|rabais|ristourne|discount|promo|n[ée]goci|geste commercial|moins cher|dernier prix|meilleur prix|baisser? le prix|prix sp[ée]cial)/i;
const CUSTOM_RE = /(sur[\s-]?mesure|hors[\s-]?standard|dimensions? sp[ée]ciales?|fabrication sp[ée]ciale|taille sp[ée]ciale|mesure sp[ée]ciale)/i;
/** Paliers présents dans le référentiel mais non validés pour le site : refus automatique au-delà. */
const UNVALIDATED_TIERS: Record<string, number> = { "EXT-CO2-2": 20 };

export type QuoteLine = { p: Product; qty: number };
export type Transport = { mode: "retrait" | "option" | "a_confirmer"; ville: string; montant: number; label: string };

const normCity = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const CITY_ALIASES: Record<string, string[]> = { casablanca: ["casa", "dbayda", "darbeida", "daralbeida"] };

/** Transport du devis : villes et frais du back-office (Villes de livraison), toujours en option hors total. */
export function transportFor(city: string, pickup: boolean, cfg: ShippingConfig = DEFAULT_SHIPPING): Transport {
  const c = city.trim();
  if (pickup) return { mode: "retrait", ville: c, montant: 0, label: "Retrait au dépôt (gratuit)" };
  const n = normCity(c);
  const hit = cfg.cities.find((x) => x.available && (normCity(x.name) === n || normCity(x.slug) === n || (CITY_ALIASES[x.slug] ?? []).includes(n)));
  if (hit && hit.fee != null && hit.fee > 0) return { mode: "option", ville: hit.name, montant: hit.fee, label: `${hit.name} : ${hit.fee} DH TTC en option, hors total` };
  return { mode: "a_confirmer", ville: hit?.name ?? c, montant: 0, label: `${hit?.name ?? c} : transport à confirmer, hors total` };
}

/** Prix unitaire TTC appliqué (palier validé : EI60 1 vantail 80/90/100 à 2 000 DH dès 4 portes, tailles mélangées). */
export function unitPrices(lines: QuoteLine[]) {
  const tierQty = lines.filter((l) => (DOOR_TIER.ids as readonly string[]).includes(l.p.id)).reduce((s, l) => s + l.qty, 0);
  return lines.map((l) => {
    const tier = (DOOR_TIER.ids as readonly string[]).includes(l.p.id) && tierQty >= DOOR_TIER.min && categoryKey(l.p) !== "galandage";
    const unit = tier ? Math.min(DOOR_TIER.price, l.p.price) : l.p.price;
    return { ...l, unit, tier, total: unit * l.qty };
  });
}

export function refusalReasons(lines: QuoteLine[], opts: { note: string; custom: boolean; kitLeafM?: number | null }): string[] {
  const r: string[] = [];
  if (opts.custom || CUSTOM_RE.test(opts.note)) r.push("Demande sur-mesure");
  if (DISCOUNT_RE.test(opts.note)) r.push("Demande de remise / prix négocié");
  for (const { p, qty } of lines) {
    if (!p.price || p.price <= 0) r.push(`${p.id} : prix manquant`);
    if (p.priceToConfirm) r.push(`${p.id} : prix à confirmer`);
    if (p.stockToConfirm) r.push(`${p.id} : stock à confirmer`);
    const av = effectiveAvailability(p);
    if (av !== "en stock") r.push(`${p.id} : ${av}`);
    else if (p.stockQty != null && qty > p.stockQty) r.push(`${p.id} : stock insuffisant (${p.stockQty} disponibles, ${qty} demandés)`);
    if (UNVALIDATED_TIERS[p.id] && qty >= UNVALIDATED_TIERS[p.id]) r.push(`${p.id} : quantité ≥ ${UNVALIDATED_TIERS[p.id]}, tarif quantité non validé pour le site`);
    if (p.id.startsWith("AUTO-GBAT300") && opts.kitLeafM != null && opts.kitLeafM > KIT_MAX_LEAF_M)
      r.push(`Kit G-BAT 300 : vantail de ${String(opts.kitLeafM).replace(".", ",")} m (> 2,5 m)`);
  }
  return [...new Set(r)];
}

/* ---------------------------- Exécution ---------------------------- */
let chain: Promise<unknown> = Promise.resolve();
/** Une génération à la fois (numéro + PDF + journal restent cohérents). */
export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}

const CHILD_ENV = { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C.UTF-8", PYTHONIOENCODING: "utf-8" } as unknown as NodeJS.ProcessEnv;

export type GeneratorInput = {
  numero: string | number;
  date?: string;
  client: string;
  telephone?: string;
  ice?: string;
  ville?: string;
  lignes: { reference: string; qte: number; largeur_vantail_m?: number }[];
  transport: { mode: string; ville?: string; montant?: number };
  sortie: string;
};

function parseTtc(stdout: string): number | null {
  const m = stdout.match(/Total TTC ([\d.]+,\d{2}) DH/);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : null;
}

export class DevisError extends Error {}

async function generate(cfg: DevisConfig, input: GeneratorInput): Promise<number> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "faw-devis-"));
  const json = path.join(dir, "devis.json");
  try {
    await writeFile(json, JSON.stringify(input), { mode: 0o600 });
    const { stdout } = await run(cfg.python, [cfg.generator, json], { timeout: 30_000, env: CHILD_ENV, maxBuffer: 1 << 20 });
    const ttc = parseTtc(stdout);
    if (ttc == null) throw new DevisError("sortie du générateur illisible");
    return ttc;
  } catch (e) {
    if (e instanceof DevisError) throw e;
    const msg = (e as { stderr?: string }).stderr?.toString().replace(/^ERREUR :\s*/m, "").trim();
    throw new DevisError(msg ? msg.slice(0, 300) : "échec du générateur");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Essai à blanc (numéro « TEST », fichier temporaire) : valide références, prix et textes sans consommer de numéro. */
export async function dryRun(cfg: DevisConfig, input: Omit<GeneratorInput, "numero" | "sortie">): Promise<number> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "faw-devis-dry-"));
  try {
    return await generate(cfg, { ...input, numero: "TEST", sortie: path.join(dir, "dry.pdf") });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Réserve le prochain numéro : UNIQUEMENT via prochain_numero.py. */
export async function reserveNumber(cfg: DevisConfig): Promise<number> {
  const { stdout } = await run(cfg.python, [cfg.counter], { timeout: 15_000, env: CHILD_ENV });
  const n = Number(stdout.trim());
  if (!Number.isInteger(n) || n <= 0) throw new DevisError("compteur de devis illisible");
  return n;
}

export async function generateFinal(cfg: DevisConfig, input: Omit<GeneratorInput, "sortie">, file: string) {
  await mkdir(cfg.outDir, { recursive: true, mode: 0o750 });
  const out = path.join(cfg.outDir, file);
  const ttc = await generate(cfg, { ...input, sortie: out });
  const st = await stat(out);
  if (!st.isFile() || st.size < 1000) throw new DevisError("PDF non produit");
  return { out, ttc };
}

function journalCell(v: string | number) {
  const s = String(v).replace(/[\r\n]+/g, " ").replace(/^[=+@\t]+/, "");
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Ajoute UNE ligne au journal (append seulement, jamais de réécriture). */
export async function appendJournal(cfg: DevisConfig, row: { numero: number; date: string; last4: string; nom: string; produits: string; total: number; ville: string; remarque: string }) {
  let prefix = "";
  try {
    const fh = await open(cfg.journal, "r");
    try {
      const { size } = await fh.stat();
      if (size > 0) {
        const b = Buffer.alloc(1);
        await fh.read(b, 0, 1, size - 1);
        if (b[0] !== 0x0a) prefix = "\n";
      }
    } finally {
      await fh.close();
    }
  } catch {
    throw new DevisError("journal introuvable");
  }
  const line = [row.numero, row.date, row.last4, row.nom, row.produits, row.total, row.ville, row.remarque].map(journalCell).join(",");
  await appendFile(cfg.journal, `${prefix}${line}\n`, "utf8");
}

export async function whatsappTemplate(cfg: DevisConfig | null, total: number): Promise<string> {
  const fallback = "Bonjour, voici votre devis FAW 📄 Total : {TOTAL} DH TTC, valable 14 jours. Il vous suffit de répondre à ce message pour confirmer, merci !";
  let tpl = fallback;
  try {
    if (cfg?.message) {
      const md = await readFile(cfg.message, "utf8");
      const m = md.match(/## Français\s*\n([^\n#]+)/);
      if (m) tpl = m[1].trim();
    }
  } catch {}
  return tpl.replace("{TOTAL}", new Intl.NumberFormat("fr-FR").format(total).replace(/\u202f|\u00a0/g, " "));
}

export function casablancaStamp(d = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { journal: `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`, pdf: `${p.day}/${p.month}/${String(p.year).slice(2)}` };
}

export const newToken = () => randomBytes(24).toString("base64url");
/** Jeton privé d'un devis : 24 octets aléatoires (192 bits) en base64url = 32 caractères. */
export const QUOTE_TOKEN_RE = /^[\w-]{32}$/;
export const safePdfName = (f: string) => /^Devis-\d+-FAW(-\d+)?\.pdf$/.test(f);

export function devisOutDir() {
  return path.resolve(process.env.DEVIS_OUTPUT_DIR?.trim() || path.join(process.cwd(), "data", "devis"));
}

/** Réponse HTTP du PDF stocké (nom de fichier contrôlé, jamais de chemin fourni par l'utilisateur). */
export async function pdfResponse(file: string, download = false): Promise<Response> {
  if (!safePdfName(file)) return new Response("Introuvable", { status: 404 });
  try {
    const buf = await readFile(path.join(devisOutDir(), file));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${file}"`,
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}

/* ---------------------- Validation par l'équipe ---------------------- */
export const QUOTE_STATUSES = ["à valider", "validé", "envoyé", "refusé"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = { "à valider": "À valider", "validé": "Validé", "envoyé": "Envoyé", "refusé": "Refusé / annulé" };

/** Champs de la ligne de journal, préparés à la demande et écrits seulement à l'envoi. */
export type JournalInput = { last4: string; nom: string; produits: string; ville: string };

/**
 * Brouillon interne : numéro « BROUILLON » (aucun numéro réservé), fichier temporaire,
 * filigrane BROUILLON ajouté sur chaque page. Jamais stocké, jamais accessible au client.
 */
export async function generateDraft(cfg: DevisConfig, input: Omit<GeneratorInput, "numero" | "sortie">): Promise<Buffer> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "faw-devis-draft-"));
  try {
    const out = path.join(dir, "brouillon.pdf");
    await generate(cfg, { ...input, numero: "BROUILLON", sortie: out });
    const { PDFDocument, StandardFonts, rgb, degrees } = await import("pdf-lib");
    const doc = await PDFDocument.load(await readFile(out));
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      const size = 96;
      const w = bold.widthOfTextAtSize("BROUILLON", size);
      page.drawText("BROUILLON", { x: width / 2 - (w / 2) * Math.cos(Math.PI / 5), y: height / 2 - (w / 2) * Math.sin(Math.PI / 5), size, font: bold, color: rgb(0.8, 0.1, 0.1), opacity: 0.16, rotate: degrees(36) });
      const foot = "BROUILLON interne - non validé par l'équipe FAW - sans numéro - ne pas envoyer";
      page.drawText(foot, { x: width / 2 - bold.widthOfTextAtSize(foot, 9) / 2, y: 22, size: 9, font: bold, color: rgb(0.75, 0, 0) });
    }
    doc.setTitle("Devis FAW - BROUILLON");
    return Buffer.from(await doc.save());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Première page d'un PDF en PNG (aperçu dans l'admin), via pdftoppm. */
export async function pdfFirstPagePng(pdf: Buffer): Promise<Buffer | null> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "faw-devis-png-"));
  try {
    const src = path.join(dir, "in.pdf");
    await writeFile(src, pdf, { mode: 0o600 });
    await run("pdftoppm", ["-png", "-r", "90", "-f", "1", "-l", "1", "-singlefile", src, path.join(dir, "out")], { timeout: 20_000, env: CHILD_ENV });
    return await readFile(path.join(dir, "out.png"));
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Numéro WhatsApp international (wa.me) à partir d'un numéro normalisé +212… */
export function waClientLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

type Priced = ReturnType<typeof unitPrices>;
/** Lignes pour le générateur (largeur de vantail pour le kit G-BAT 300). */
export function generatorLines(priced: Priced, kitLeaf: number | null | undefined) {
  // Promotion active : prix unitaire TTC imposé (le devis reprend le prix actif du site, jamais de « remise »).
  return priced.map((l) => ({
    reference: l.p.id,
    qte: l.qty,
    ...(l.p.compareAt ? { prix_ttc_walfar: l.unit } : {}),
    ...(l.p.id.startsWith("AUTO-GBAT300") && kitLeaf ? { largeur_vantail_m: kitLeaf } : {}),
  }));
}
export const journalProducts = (priced: Priced) => priced.map((l) => `${l.qty} x ${l.p.id} ${l.p.title} ${l.unit}`).join(" ; ");
export const linesJson = (priced: Priced) => JSON.stringify(priced.map((l) => ({ id: l.p.id, title: l.p.title, qty: l.qty, unit: l.unit, total: l.total, tier: l.tier })));
