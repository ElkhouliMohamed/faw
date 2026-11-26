import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { allProducts } from "@/lib/catalog";
import { forbidden } from "@/lib/content-rules";
import { merch } from "@/lib/merch";
import { SITE } from "@/lib/site";
import { readUpload, safeUploadName } from "@/lib/uploads";

/** Texte compatible WinAnsi (polices standard pdf-lib) ; tout le reste est retiré. */
function ansi(s: string) {
  return s
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d«»]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u2026/g, "...")
    .replace(/[\u00a0\u202f]/g, " ").replace(/\u2265/g, ">=").replace(/\u2264/g, "<=")
    .replace(/[^\x20-\x7e\u00a0-\u00ff\u0152\u0153\u20ac]/g, "");
}
const dh = (n: number) => `${n.toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ")} DH TTC`;

async function thumb(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    let buf: Buffer | null = null;
    const up = url.match(/^\/media\/([^/]+)$/);
    if (up) buf = safeUploadName(up[1]) ? ((await readUpload(up[1])) as Buffer | null) : null;
    else if (/^\/[A-Za-z0-9/_.-]+$/.test(url) && !url.includes("..")) buf = await readFile(path.join(process.cwd(), "public", url));
    if (!buf) return null;
    return await sharp(buf).resize(220, 220, { fit: "contain", background: "#ffffff" }).flatten({ background: "#ffffff" }).jpeg({ quality: 72 }).toBuffer();
  } catch {
    return null;
  }
}

/**
 * Catalogue client : marque FAW, prix ACTIFS TTC (promotions en cours), jamais de prix d'achat ni de nom de
 * fournisseur / fabricant (le champ « marque » n'est pas imprimé ; tout texte contenant une mention interdite est omis).
 */
export async function catalogPdf(): Promise<{ pdf: Buffer; count: number; skipped: string[] }> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const [products, m] = await Promise.all([allProducts(), merch()]);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.13, 0.11, 0.1), muted = rgb(0.42, 0.39, 0.36), copper = rgb(0.58, 0.345, 0.18), line = rgb(0.87, 0.84, 0.8);
  const W = 595.28, H = 841.89, M = 42;
  let logo = null;
  try { logo = await doc.embedPng(await readFile(path.join(process.cwd(), "public", "brand", "logo-faw.png"))); } catch {}
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Casablanca" }).format(new Date());

  let page = doc.addPage([W, H]);
  let y = 0;
  let pageNo = 0;
  const footer = () => {
    pageNo++;
    const f = ansi(`${SITE.name} · ${SITE.address} · ${SITE.phone} · ${SITE.email} · ${SITE.url.replace(/^https?:\/\//, "")}`);
    page.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.5, color: line });
    page.drawText(f, { x: M, y: 26, size: 7.5, font, color: muted });
    page.drawText(String(pageNo), { x: W - M - font.widthOfTextAtSize(String(pageNo), 8), y: 26, size: 8, font, color: muted });
  };
  const header = (first: boolean) => {
    y = H - M;
    if (logo) {
      const h = first ? 46 : 26, w = (logo.width / logo.height) * h;
      page.drawImage(logo, { x: M, y: y - h, width: w, height: h });
    } else page.drawText("FAW Aluminium", { x: M, y: y - 20, size: 18, font: bold, color: ink });
    const t = first ? "Catalogue produits" : "Catalogue produits (suite)";
    page.drawText(ansi(t), { x: W - M - bold.widthOfTextAtSize(t, first ? 16 : 10), y: y - (first ? 22 : 14), size: first ? 16 : 10, font: bold, color: ink });
    const d = ansi(`Prix TTC (TVA 20 %) au ${date}`);
    page.drawText(d, { x: W - M - font.widthOfTextAtSize(d, 8.5), y: y - (first ? 38 : 26), size: 8.5, font, color: muted });
    y -= first ? 70 : 44;
  };
  const newPage = () => { footer(); page = doc.addPage([W, H]); header(false); };
  header(true);
  const fees = m.shipping.cities.filter((c) => c.available).map((c) => `${c.name} ${c.fee && c.fee > 0 ? `${c.fee} DH` : "sur devis"}`).join(", ");
  const intro = `Prix TTC, sous réserve de disponibilité. Transport : ${fees ? `${fees}, ` : ""}autres villes sur devis.`;
  page.drawText(ansi(intro), { x: M, y, size: 8.5, font, color: muted, maxWidth: W - 2 * M });
  y -= 22;

  const wrap = (text: string, f: typeof font, size: number, width: number, maxLines: number) => {
    const words = ansi(text).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(t, size) <= width) cur = t;
      else { if (cur) lines.push(cur); cur = w; }
      if (lines.length >= maxLines) break;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    if (lines.length === maxLines && words.join(" ").length > lines.join(" ").length) lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, "") + "...";
    return lines;
  };

  const order = new Map(m.categories.map((c, i) => [c.label, i]));
  const groups = new Map<string, typeof products>();
  for (const p of [...products].sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99)))
    groups.set(p.category, [...(groups.get(p.category) ?? []), p]);
  const skipped: string[] = [];
  let count = 0;
  const ROW = 78;
  for (const [cat, list] of groups) {
    if (y < 60 + 28 + ROW) newPage();
    page.drawText(ansi(cat).toUpperCase(), { x: M, y, size: 10, font: bold, color: copper });
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: copper });
    y -= 10;
    for (const p of list) {
      const desc = p.shortDescription || p.description;
      if (forbidden(p.title, desc, p.variantLabel)) { skipped.push(p.id); continue; }
      if (y < 60 + ROW) newPage();
      const top = y;
      const img = await thumb(p.image);
      if (img) {
        const e = await doc.embedJpg(img);
        page.drawImage(e, { x: M, y: top - 64, width: 64, height: 64 });
      } else page.drawRectangle({ x: M, y: top - 64, width: 64, height: 64, borderColor: line, borderWidth: 0.6 });
      const x = M + 78, priceW = 130, tw = W - M - x - priceW - 8;
      const tl = wrap(p.title, bold, 10, tw, 2);
      let ty = top - 11;
      for (const l of tl) { page.drawText(l, { x, y: ty, size: 10, font: bold, color: ink }); ty -= 12; }
      page.drawText(ansi(`Réf. ${p.id} · ${p.availability}`), { x, y: ty, size: 7.5, font, color: muted });
      ty -= 11;
      for (const l of wrap(desc.replace(/\s+/g, " "), font, 8, tw, 3)) { page.drawText(l, { x, y: ty, size: 8, font, color: ink }); ty -= 10; }
      const priceTxt = p.price > 0 && !p.priceToConfirm ? dh(p.price) : "Prix sur devis";
      page.drawText(priceTxt, { x: W - M - bold.widthOfTextAtSize(priceTxt, 11), y: top - 13, size: 11, font: bold, color: ink });
      if (p.compareAt && p.price > 0) {
        const old = dh(p.compareAt), ow = font.widthOfTextAtSize(old, 8.5), ox = W - M - ow;
        page.drawText(old, { x: ox, y: top - 27, size: 8.5, font, color: muted });
        page.drawLine({ start: { x: ox, y: top - 24 }, end: { x: ox + ow, y: top - 24 }, thickness: 0.6, color: muted });
      }
      y = top - ROW;
      page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.4, color: line });
      count++;
    }
    y -= 10;
  }
  footer();
  doc.setTitle("Catalogue FAW Aluminium");
  doc.setAuthor("FAW Aluminium");
  doc.setProducer("FAW Aluminium");
  doc.setCreator("FAW Aluminium");
  return { pdf: Buffer.from(await doc.save()), count, skipped };
}
