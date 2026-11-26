import "server-only";
import { stat, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { saveProductImage, safeUploadName, uploadDir } from "@/lib/uploads";

export const cleanAlt = (s: string) => s.replace(/[<>\u0000-\u001f]/g, "").trim().slice(0, 160);

export async function storeMedia(file: File, alt: string) {
  const r = await saveProductImage(file);
  if (!r.ok) return r;
  const name = r.url.slice("/media/".length);
  const full = path.join(uploadDir(), name);
  const [meta, st] = await Promise.all([sharp(full).metadata(), stat(full)]);
  const originalName = file.name.replace(/[^\w.\- ]/g, "_").slice(0, 120);
  const m = await prisma.media.create({ data: { file: name, url: r.url, alt: cleanAlt(alt), width: meta.width ?? null, height: meta.height ?? null, size: st.size, originalName } });
  return { ok: true as const, media: m };
}

/** Où l'image est-elle utilisée ? (suppression bloquée tant qu'elle sert). */
export async function mediaUsage(url: string) {
  const like = { contains: url };
  const [products, cats, bundles, landings, settings] = await Promise.all([
    prisma.product.findMany({ where: { image: url }, select: { id: true } }),
    prisma.category.findMany({ where: { image: url }, select: { slug: true } }),
    prisma.bundle.findMany({ where: { image: url }, select: { slug: true } }),
    prisma.landingPage.findMany({ where: { blocks: like }, select: { slug: true } }),
    prisma.setting.findMany({ where: { value: like }, select: { key: true } }),
  ]);
  return [
    ...products.map((p) => `produit ${p.id}`),
    ...cats.map((c) => `catégorie ${c.slug}`),
    ...bundles.map((b) => `pack ${b.slug}`),
    ...landings.map((l) => `landing ${l.slug}`),
    ...settings.map((s) => `réglage ${s.key}`),
  ];
}

export async function removeMediaFile(name: string) {
  if (!safeUploadName(name)) return;
  try {
    await unlink(path.join(uploadDir(), name));
  } catch {}
}
