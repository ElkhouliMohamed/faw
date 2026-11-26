"use server";
import { requireWrite } from "@/lib/admin/perm";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { invalidateCatalog } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { AVAILABILITIES, CATEGORIES } from "@/lib/products";
import { saveProductImage } from "@/lib/uploads";
import { forbidden } from "@/lib/content-rules";

async function guard() {
  return requireWrite("products");
}
function refresh() {
  invalidateCatalog();
  revalidatePath("/", "layout");
}

export type RowState = { ok: boolean; message: string } | null;

const rowSchema = z.object({
  id: z.string().min(2).max(40),
  price: z.coerce.number().int("Prix entier").min(0).max(1_000_000),
  stockQty: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000)]),
  availability: z.enum(AVAILABILITIES),
  active: z.boolean(),
});

export async function updateStockRow(_prev: RowState, fd: FormData): Promise<RowState> {
  await guard();
  const parsed = rowSchema.safeParse({
    id: fd.get("id"),
    price: String(fd.get("price") ?? "").replace(/\s/g, ""),
    stockQty: String(fd.get("stockQty") ?? "").trim(),
    availability: fd.get("availability"),
    active: fd.get("active") === "1",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides" };
  const v = parsed.data;
  const p = await prisma.product.findUnique({ where: { id: v.id } });
  if (!p) return { ok: false, message: "Produit introuvable" };
  await prisma.product.update({
    where: { id: v.id },
    data: { price: v.price, stockQty: v.stockQty === "" ? null : v.stockQty, availability: v.availability, active: v.active },
  });
  refresh();
  return { ok: true, message: "Enregistré" };
}

export type NewProductState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const newSchema = z.object({
  title: z.string().trim().min(4, "Nom requis").max(70, "60 à 70 caractères maximum"),
  id: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{1,30}$/, "Référence : lettres, chiffres et tirets"),
  category: z.enum(CATEGORIES.map((c) => c.label) as [string, ...string[]]),
  price: z.coerce.number().int("Prix entier en DH").min(1, "Prix TTC requis").max(1_000_000),
  description: z.string().trim().min(20, "Description courte requise (20 caractères min.)").max(600),
  availability: z.enum(AVAILABILITIES),
  stockQty: z.union([z.literal(""), z.coerce.number().int().min(0).max(100_000)]),
  variants: z.string().max(2000).optional().default(""),
});

/**
 * Ajout d'un produit. Variantes de taille facultatives, une par ligne : « 90 cm ; 2200 ».
 * Chaque variante devient une fiche sœur (référence REF-90-CM…), reliée par le sélecteur de taille.
 */
export async function createProduct(_prev: NewProductState, fd: FormData): Promise<NewProductState> {
  await guard();
  const parsed = newSchema.safeParse({
    title: fd.get("title") ?? "",
    id: fd.get("id") ?? "",
    category: fd.get("category") ?? "",
    price: String(fd.get("price") ?? "").replace(/\s/g, ""),
    description: fd.get("description") ?? "",
    availability: fd.get("availability") ?? "en stock",
    stockQty: String(fd.get("stockQty") ?? "").trim(),
    variants: fd.get("variants") ?? "",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, message: "Vérifiez les champs signalés.", errors };
  }
  const v = parsed.data;
  const bad = forbidden(v.title, v.description, v.variants);
  if (bad) return { ok: false, message: `Texte refusé : ${bad} n'est pas autorisé sur la boutique.` };

  const variants: { label: string; price: number }[] = [];
  for (const line of v.variants.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/^(.{1,40}?)\s*[;|]\s*(\d[\d\s]*)$/);
    if (!m) return { ok: false, message: `Variante illisible : « ${line} » (format : 90 cm ; 2200)`, errors: { variants: "Format : libellé ; prix" } };
    variants.push({ label: m[1].trim(), price: Number(m[2].replace(/\s/g, "")) });
  }
  if (variants.length > 12) return { ok: false, message: "12 variantes maximum" };

  let image: string | null = null;
  const file = fd.get("photo");
  if (file instanceof File && file.size > 0) {
    const up = await saveProductImage(file);
    if (!up.ok) return { ok: false, message: up.error, errors: { photo: up.error } };
    image = up.url;
  }

  const base = { category: v.category, description: v.description, shortDescription: v.description.slice(0, 160), brand: "FAW Aluminium", image, availability: v.availability, stockQty: v.stockQty === "" ? null : v.stockQty };
  const rows = variants.length
    ? variants.map((x) => {
        const suffix = slugify(x.label).toUpperCase();
        return { id: `${v.id}-${suffix}`.slice(0, 40), slug: slugify(`${v.title} ${x.label}`), title: `${v.title} ${x.label}`.slice(0, 80), price: x.price, variantLabel: x.label };
      })
    : [{ id: v.id, slug: slugify(v.title), title: v.title, price: v.price, variantLabel: null as string | null }];

  const ids = rows.map((r) => r.id);
  const slugs = rows.map((r) => r.slug);
  const clash = await prisma.product.findFirst({ where: { OR: [{ id: { in: ids } }, { slug: { in: slugs } }] } });
  if (clash) return { ok: false, message: `Référence ou adresse déjà utilisée (${clash.id})`, errors: { id: "Déjà utilisée" } };
  const max = await prisma.product.aggregate({ _max: { sortOrder: true } });
  let order = (max._max.sortOrder ?? 0) + 1;
  await prisma.$transaction(
    rows.map((r) =>
      prisma.product.create({
        data: { ...base, ...r, seoTitle: r.title, variantGroup: variants.length ? slugify(v.id) : null, sortOrder: order++ },
      }),
    ),
  );
  refresh();
  return { ok: true, message: rows.length > 1 ? `${rows.length} fiches créées (${ids.join(", ")})` : `Produit ${ids[0]} créé` };
}
