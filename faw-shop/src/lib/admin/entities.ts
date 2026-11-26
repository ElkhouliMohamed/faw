import "server-only";
// Définitions des modules CRUD génériques du back-office (liste + formulaire + validation + audit).
import { hashPassword } from "@/lib/admin-auth";
import { invalidateCatalog } from "@/lib/catalog";
import { forbidden } from "@/lib/content-rules";
import { prisma } from "@/lib/db";
import { invalidateMerch } from "@/lib/merch";
import { AVAILABILITIES } from "@/lib/products";
import { BLOCKS_HELP } from "./blocks";
import type { FieldSpec, Option } from "./crud-types";
import { ROLE_LABEL, ROLES } from "./modules";

export type Row = Record<string, unknown> & { id: string | number };
export type Column = { name: string; label: string; kind?: "text" | "bool" | "money" | "date" | "badge" | "mono"; get?: (r: Row) => string | number | boolean | null };
type Data = Record<string, unknown>;
type Ctx = { id: string | number | null; prev: Row | null };

export type EntityDef = {
  key: string;
  perm: string;
  title: string;
  singular: string;
  model: string;
  idType: "int" | "string";
  intro?: string;
  /** Avertissement affiché en tête (ex. promotions = prix barré). */
  warning?: string;
  fields: FieldSpec[] | (() => Promise<FieldSpec[]>);
  columns: Column[];
  orderBy: Record<string, "asc" | "desc">[];
  search: string[];
  create?: boolean;
  edit?: boolean;
  /** "delete" = suppression réelle ; "none" = archivage par le champ actif. */
  remove?: "delete" | "none";
  pageSize?: number;
  /** Valeurs du formulaire à partir d'une ligne (champs virtuels inclus). */
  toForm?: (r: Row) => Promise<Data> | Data;
  /** Contrôles métier + conversion avant enregistrement. Retourne une chaîne = erreur. */
  transform?: (d: Data, c: Ctx) => Promise<Data | { error: string; field?: string }>;
  afterSave?: (saved: Row, d: Data, c: Ctx) => Promise<void>;
  canDelete?: (r: Row) => Promise<string | null>;
  /** Pages publiques à revalider ("layout" = tout le site). */
  revalidate?: "layout" | string[];
  merch?: boolean;
  catalog?: boolean;
  publicHref?: (r: Row) => string | null;
};

/* ----------------------------- Options dynamiques ----------------------------- */
const opt = (value: string, label: string): Option => ({ value, label });
async function catOptions() {
  return (await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { label: "asc" }] })).map((c) => opt(c.slug, c.label));
}
async function productOptions() {
  return (await prisma.product.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }], select: { id: true, title: true, active: true } })).map((p) =>
    opt(p.id, `${p.id} – ${p.title}${p.active ? "" : " (archivé)"}`),
  );
}
async function cityOptions() {
  return (await prisma.shippingCity.findMany({ orderBy: [{ sortOrder: "asc" }] })).map((c) => opt(c.slug, c.name));
}
async function warrantyOptions() {
  return [opt("", "Aucune"), ...(await prisma.warranty.findMany({ orderBy: { name: "asc" } })).map((w) => opt(String(w.id), w.name))];
}
async function badgeOptions() {
  return (await prisma.badge.findMany({ orderBy: [{ sortOrder: "asc" }] })).map((b) => opt(String(b.id), b.label));
}

const csvList = (v: unknown) => (Array.isArray(v) ? v.map(String) : String(v ?? "").split(",")).map((x) => x.trim()).filter(Boolean);
const err = (error: string, field?: string) => ({ error, field });
function rules(d: Data, ...keys: string[]) {
  for (const k of keys) {
    const f = forbidden(typeof d[k] === "string" ? (d[k] as string) : null);
    if (f) return err(`Mention interdite (${f})`, k);
  }
  return null;
}

/* --------------------------------- Modules --------------------------------- */
const categories: EntityDef = {
  key: "categories",
  perm: "categories",
  title: "Catégories",
  singular: "catégorie",
  model: "category",
  idType: "int",
  intro: "Les produits sont rattachés à une catégorie par son libellé. La famille détermine les règles de livraison et de devis.",
  fields: async () => [
    { name: "label", label: "Libellé", type: "text", required: true, max: 80 },
    { name: "slug", label: "Slug (URL)", type: "slug", required: true, max: 60, help: "Utilisé dans /produits?categorie=…" },
    { name: "short", label: "Libellé court", type: "text", max: 40 },
    { name: "family", label: "Famille", type: "select", required: true, options: [opt("portes-coupe-feu", "Portes coupe-feu"), opt("galandage", "Galandage"), opt("automatisme", "Automatisme"), opt("incendie", "Sécurité incendie")] },
    { name: "description", label: "Description", type: "textarea", max: 2000 },
    { name: "image", label: "Image", type: "image" },
    { name: "warrantyId", label: "Garantie (par défaut)", type: "select", options: await warrantyOptions() },
    { name: "sortOrder", label: "Ordre", type: "int", min: 0, max: 9999 },
    { name: "active", label: "Visible sur la boutique", type: "bool" },
    { name: "seoTitle", label: "Titre SEO", type: "text", max: 70, section: "SEO" },
    { name: "seoDescription", label: "Meta description", type: "textarea", max: 170, section: "SEO" },
  ],
  columns: [
    { name: "label", label: "Libellé" },
    { name: "slug", label: "Slug", kind: "mono" },
    { name: "family", label: "Famille" },
    { name: "sortOrder", label: "Ordre" },
    { name: "active", label: "Visible", kind: "bool" },
  ],
  orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  search: ["label", "slug"],
  remove: "delete",
  transform: async (d) => {
    const r = rules(d, "label", "description", "seoTitle", "seoDescription");
    if (r) return r;
    d.warrantyId = d.warrantyId ? Number(d.warrantyId) : null;
    return d;
  },
  afterSave: async (saved, _d, c) => {
    // Renommage : les produits suivent (rattachement par libellé).
    if (c.prev && c.prev.label !== saved.label) await prisma.product.updateMany({ where: { category: String(c.prev.label) }, data: { category: String(saved.label) } });
  },
  canDelete: async (r) => {
    const n = await prisma.product.count({ where: { category: String(r.label) } });
    return n ? `${n} produit(s) utilisent cette catégorie : déplacez-les ou masquez la catégorie.` : null;
  },
  revalidate: "layout",
  merch: true,
  catalog: true,
  publicHref: (r) => `/produits?categorie=${r.slug}`,
};

const products: EntityDef = {
  key: "products",
  perm: "products",
  title: "Produits",
  singular: "produit",
  model: "product",
  idType: "string",
  intro: "Fiches produits complètes. Les prix et le stock se modifient aussi en masse dans « Stock & prix ». Un produit n'est jamais supprimé : décochez « Visible » pour l'archiver.",
  fields: async () => {
    const attrs = await prisma.attribute.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }] });
    const cats = await prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }] });
    return [
      { name: "id", label: "Référence", type: "text", required: true, max: 40, createOnly: true, help: "Majuscules, chiffres et tirets (ex. CF-EI60-90)." },
      { name: "title", label: "Nom", type: "text", required: true, max: 90 },
      { name: "slug", label: "Slug (URL)", type: "slug", required: true, max: 80 },
      { name: "category", label: "Catégorie", type: "select", required: true, options: cats.map((c) => opt(c.label, c.label)) },
      { name: "price", label: "Prix TTC (DH)", type: "money", required: true, min: 0, max: 1_000_000, help: "Prix de base. Une promotion active l'affiche barré." },
      { name: "availability", label: "Disponibilité", type: "select", required: true, options: AVAILABILITIES.map((a) => opt(a, a)) },
      { name: "stockQty", label: "Stock (vide = non suivi)", type: "int", nullable: true, min: 0, max: 100000 },
      { name: "priceToConfirm", label: "Prix à confirmer", type: "bool" },
      { name: "stockToConfirm", label: "Stock à confirmer", type: "bool" },
      { name: "active", label: "Visible sur la boutique", type: "bool" },
      { name: "sortOrder", label: "Ordre", type: "int", min: 0, max: 9999 },
      { name: "image", label: "Image principale", type: "image" },
      { name: "shortDescription", label: "Accroche", type: "text", max: 200 },
      { name: "description", label: "Description", type: "textarea", required: true, max: 5000, rows: 6 },
      { name: "variantGroup", label: "Groupe de variantes", type: "text", max: 60, help: "Même valeur pour les fiches sœurs (sélecteur de taille)." },
      { name: "variantLabel", label: "Libellé de variante", type: "text", max: 40 },
      { name: "badges", label: "Badges", type: "multi", options: await badgeOptions(), section: "Merchandising" },
      { name: "warrantyId", label: "Garantie", type: "select", options: [opt("", "Celle de la catégorie"), ...(await warrantyOptions()).slice(1)], section: "Merchandising" },
      ...attrs.map<FieldSpec>((a) => ({
        name: `attr__${a.key}`,
        label: `${a.label}${a.unit ? ` (${a.unit})` : ""}`,
        type: a.kind === "select" ? "select" : "text",
        options: a.kind === "select" ? [opt("", "—"), ...a.options.split("\n").map((x) => x.trim()).filter(Boolean).map((x) => opt(x, x))] : undefined,
        max: 120,
        section: "Caractéristiques (attributs)",
      })),
      { name: "seoTitle", label: "Titre H1 / SEO historique", type: "text", required: true, max: 120, section: "SEO" },
      { name: "metaTitle", label: "Titre de page (meta title)", type: "text", max: 70, section: "SEO", help: "Vide = titre généré." },
      { name: "metaDescription", label: "Meta description", type: "textarea", max: 170, section: "SEO", help: "Vide = description générée." },
    ];
  },
  columns: [
    { name: "id", label: "Réf.", kind: "mono" },
    { name: "title", label: "Nom" },
    { name: "category", label: "Catégorie" },
    { name: "price", label: "Prix TTC", kind: "money" },
    { name: "availability", label: "Dispo." },
    { name: "active", label: "Visible", kind: "bool" },
  ],
  orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
  search: ["id", "title", "category"],
  remove: "none",
  pageSize: 100,
  toForm: (r) => {
    const out: Data = { ...r, warrantyId: r.warrantyId == null ? "" : String(r.warrantyId), badges: csvList(r.badges) };
    try {
      for (const [k, v] of Object.entries(JSON.parse(String(r.attributes || "{}")) as Record<string, unknown>)) out[`attr__${k}`] = String(v ?? "");
    } catch {}
    return out;
  },
  transform: async (d, c) => {
    if (!c.prev) {
      const id = String(d.id ?? "").toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(id)) return err("Référence invalide", "id");
      if (await prisma.product.findUnique({ where: { id } })) return err("Cette référence existe déjà", "id");
      d.id = id;
    }
    const r = rules(d, "title", "description", "shortDescription", "seoTitle", "metaTitle", "metaDescription");
    if (r) return r;
    const attrs: Record<string, string> = {};
    for (const k of Object.keys(d)) {
      if (!k.startsWith("attr__")) continue;
      const v = String(d[k] ?? "").trim();
      if (v) {
        const f = forbidden(v);
        if (f) return err(`Mention interdite (${f})`, k);
        attrs[k.slice(6)] = v;
      }
      delete d[k];
    }
    // Conserve les valeurs d'attributs désactivés.
    try {
      const old = JSON.parse(String(c.prev?.attributes || "{}")) as Record<string, string>;
      const activeKeys = new Set((await prisma.attribute.findMany({ where: { active: true }, select: { key: true } })).map((a) => a.key));
      for (const [k, v] of Object.entries(old)) if (!activeKeys.has(k)) attrs[k] = v;
    } catch {}
    d.attributes = JSON.stringify(attrs);
    d.badges = csvList(d.badges).join(",");
    d.warrantyId = d.warrantyId ? Number(d.warrantyId) : null;
    for (const k of ["variantGroup", "variantLabel", "shortDescription", "image"]) if (d[k] === "") d[k] = null;
    return d;
  },
  revalidate: "layout",
  merch: false,
  catalog: true,
  publicHref: (r) => (r.active ? `/produits/${r.slug}` : null),
};

const feeRules: EntityDef = {
  key: "fee-rules",
  perm: "fee-rules",
  title: "Assigner frais",
  singular: "règle de frais",
  model: "feeRule",
  idType: "int",
  intro:
    "Exceptions de transport par produit ou catégorie. Sans règle, les frais de la ville s'appliquent (Villes de livraison : Casablanca 400 DH, Rabat 800 DH, autres villes sur devis). Une règle produit l'emporte sur une règle catégorie ; le transport est facturé une seule fois par commande (montant le plus élevé).",
  fields: async () => [
    { name: "target", label: "Produit ou catégorie", type: "select", required: true, options: [...(await catOptions()).map((o) => opt(`category:${o.value}`, `Catégorie : ${o.label}`)), ...(await productOptions()).map((o) => opt(`product:${o.value}`, `Produit : ${o.label}`))] },
    { name: "citySlug", label: "Ville", type: "select", options: [opt("", "Toutes les villes livrées"), ...(await cityOptions())] },
    { name: "mode", label: "Tarification", type: "select", required: true, options: [opt("fixed", "Montant fixe"), opt("devis", "Sur devis")] },
    { name: "fee", label: "Montant TTC (DH)", type: "money", min: 0, max: 100000, help: "Ignoré si « sur devis ». 0 = sans frais de transport." },
    { name: "note", label: "Note interne", type: "text", max: 200 },
    { name: "active", label: "Active", type: "bool" },
  ],
  columns: [
    { name: "scope", label: "Portée" },
    { name: "target", label: "Cible", kind: "mono" },
    { name: "citySlug", label: "Ville", get: (r) => (r.citySlug ? String(r.citySlug) : "toutes") },
    { name: "mode", label: "Mode", get: (r) => (r.mode === "devis" ? "sur devis" : `${r.fee} DH`) },
    { name: "active", label: "Active", kind: "bool" },
  ],
  orderBy: [{ scope: "asc" }, { target: "asc" }],
  search: ["target", "note"],
  remove: "delete",
  toForm: (r) => ({ ...r, target: `${r.scope}:${r.target}` }),
  transform: async (d) => {
    const [scope, ...rest] = String(d.target).split(":");
    d.scope = scope;
    d.target = rest.join(":");
    if (!["product", "category"].includes(scope) || !d.target) return err("Cible invalide", "target");
    d.fee = d.mode === "devis" ? 0 : Number(d.fee ?? 0);
    return d;
  },
  revalidate: "layout",
  merch: true,
};

const shippingCities: EntityDef = {
  key: "shipping-cities",
  perm: "shipping-cities",
  title: "Villes de livraison",
  singular: "ville",
  model: "shippingCity",
  idType: "int",
  intro: "Villes proposées au panier et frais de transport (TTC, facturés une fois par commande pour les portes). Frais vide = sur devis. Aucun délai garanti : le texte de délai reste indicatif.",
  fields: [
    { name: "name", label: "Ville", type: "text", required: true, max: 60 },
    { name: "slug", label: "Identifiant", type: "slug", required: true, max: 40, createOnly: true },
    { name: "fee", label: "Frais TTC (DH)", type: "money", nullable: true, min: 0, max: 100000, help: "Vide = transport sur devis." },
    { name: "available", label: "Proposée au panier", type: "bool" },
    { name: "delayText", label: "Texte de délai (indicatif)", type: "text", max: 120, help: "Ex. « Délai confirmé par téléphone ». Pas de délai promis." },
    { name: "sortOrder", label: "Ordre", type: "int", min: 0, max: 999 },
    { name: "active", label: "Active", type: "bool" },
  ],
  columns: [
    { name: "name", label: "Ville" },
    { name: "fee", label: "Frais", get: (r) => (r.fee == null ? "sur devis" : `${r.fee} DH`) },
    { name: "available", label: "Au panier", kind: "bool" },
    { name: "delayText", label: "Délai (texte)" },
    { name: "active", label: "Active", kind: "bool" },
  ],
  orderBy: [{ sortOrder: "asc" }],
  search: ["name", "slug"],
  remove: "delete",
  transform: async (d, c) => {
    const r = rules(d, "delayText", "name");
    if (r) return r;
    if (!c.prev && ["autre", "retrait"].includes(String(d.slug))) return err("Identifiant réservé", "slug");
    return d;
  },
  canDelete: async (r) => ((await prisma.feeRule.count({ where: { citySlug: String(r.slug) } })) ? "Des règles de frais visent cette ville : supprimez-les d'abord." : null),
  revalidate: "layout",
  merch: true,
};

const warranties: EntityDef = {
  key: "warranties",
  perm: "warranties",
  title: "Assigner garanties",
  singular: "garantie",
  model: "warranty",
  idType: "int",
  intro: "Texte de garantie affiché sur la fiche produit et rappelé sur le devis. Saisissez uniquement des conditions validées par l'équipe. Une garantie produit l'emporte sur celle de la catégorie.",
  fields: async () => [
    { name: "name", label: "Nom interne", type: "text", required: true, max: 80 },
    { name: "text", label: "Texte affiché", type: "textarea", required: true, max: 1500, rows: 5 },
    { name: "active", label: "Active", type: "bool" },
    { name: "_categories", label: "Catégories", type: "multi", options: await catOptions(), section: "Assignation" },
    { name: "_products", label: "Produits (exceptions)", type: "multi", options: await productOptions(), section: "Assignation" },
  ],
  columns: [
    { name: "name", label: "Nom" },
    { name: "text", label: "Texte", get: (r) => String(r.text).slice(0, 80) },
    { name: "active", label: "Active", kind: "bool" },
  ],
  orderBy: [{ name: "asc" }],
  search: ["name", "text"],
  remove: "delete",
  toForm: async (r) => ({
    ...r,
    _categories: (await prisma.category.findMany({ where: { warrantyId: Number(r.id) }, select: { slug: true } })).map((c) => c.slug),
    _products: (await prisma.product.findMany({ where: { warrantyId: Number(r.id) }, select: { id: true } })).map((p) => p.id),
  }),
  transform: async (d) => rules(d, "text", "name") ?? d,
  afterSave: async (saved, d) => {
    const id = Number(saved.id);
    const cats = csvList(d._categories);
    const prods = csvList(d._products);
    await prisma.category.updateMany({ where: { warrantyId: id, slug: { notIn: cats } }, data: { warrantyId: null } });
    if (cats.length) await prisma.category.updateMany({ where: { slug: { in: cats } }, data: { warrantyId: id } });
    await prisma.product.updateMany({ where: { warrantyId: id, id: { notIn: prods } }, data: { warrantyId: null } });
    if (prods.length) await prisma.product.updateMany({ where: { id: { in: prods } }, data: { warrantyId: id } });
  },
  canDelete: async (r) => {
    const id = Number(r.id);
    await prisma.category.updateMany({ where: { warrantyId: id }, data: { warrantyId: null } });
    await prisma.product.updateMany({ where: { warrantyId: id }, data: { warrantyId: null } });
    return null;
  },
  revalidate: "layout",
  merch: true,
  catalog: true,
};

const attributes: EntityDef = {
  key: "attributes",
  perm: "attributes",
  title: "Attributs",
  singular: "attribut",
  model: "attribute",
  idType: "int",
  intro: "Champs de caractéristiques réutilisables (largeur, hauteur, résistance au feu, matériau…). Les valeurs se saisissent dans chaque fiche produit et s'affichent dans le tableau des caractéristiques.",
  fields: [
    { name: "label", label: "Libellé", type: "text", required: true, max: 60 },
    { name: "key", label: "Clé", type: "slug", required: true, max: 40, createOnly: true },
    { name: "unit", label: "Unité", type: "text", max: 12, placeholder: "cm, mm, kg…" },
    { name: "kind", label: "Type", type: "select", required: true, options: [opt("text", "Texte"), opt("number", "Nombre"), opt("select", "Liste")] },
    { name: "options", label: "Valeurs (une par ligne, type Liste)", type: "lines", max: 2000 },
    { name: "sortOrder", label: "Ordre", type: "int", min: 0, max: 999 },
    { name: "showInSpecs", label: "Afficher dans les caractéristiques", type: "bool" },
    { name: "active", label: "Actif", type: "bool" },
  ],
  columns: [
    { name: "label", label: "Libellé" },
    { name: "key", label: "Clé", kind: "mono" },
    { name: "unit", label: "Unité" },
    { name: "kind", label: "Type" },
    { name: "showInSpecs", label: "Affiché", kind: "bool" },
    { name: "active", label: "Actif", kind: "bool" },
  ],
  orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  search: ["label", "key"],
  remove: "delete",
  transform: async (d) => rules(d, "label", "options") ?? d,
  revalidate: "layout",
  merch: true,
};

const badges: EntityDef = {
  key: "badges",
  perm: "badges",
  title: "Badges",
  singular: "badge",
  model: "badge",
  idType: "int",
  intro: "Pastilles affichées sur les cartes et fiches produits (Nouveau, Promo, En stock…).",
  fields: async () => [
    { name: "label", label: "Libellé", type: "text", required: true, max: 24 },
    { name: "tone", label: "Couleur", type: "select", required: true, options: [opt("neutral", "Neutre"), opt("copper", "Cuivre"), opt("success", "Vert"), opt("warning", "Ambre"), opt("dark", "Sombre")] },
    { name: "sortOrder", label: "Ordre", type: "int", min: 0, max: 999 },
    { name: "active", label: "Actif", type: "bool" },
    { name: "_products", label: "Produits", type: "multi", options: await productOptions(), section: "Assignation" },
  ],
  columns: [
    { name: "label", label: "Libellé" },
    { name: "tone", label: "Couleur" },
    { name: "active", label: "Actif", kind: "bool" },
  ],
  orderBy: [{ sortOrder: "asc" }],
  search: ["label"],
  remove: "delete",
  toForm: async (r) => ({ ...r, _products: (await prisma.product.findMany({ select: { id: true, badges: true } })).filter((p) => csvList(p.badges).includes(String(r.id))).map((p) => p.id) }),
  transform: async (d) => rules(d, "label") ?? d,
  afterSave: async (saved, d) => {
    const id = String(saved.id);
    const want = new Set(csvList(d._products));
    for (const p of await prisma.product.findMany({ select: { id: true, badges: true } })) {
      const cur = csvList(p.badges);
      const has = cur.includes(id);
      if (want.has(p.id) && !has) await prisma.product.update({ where: { id: p.id }, data: { badges: [...cur, id].join(",") } });
      if (!want.has(p.id) && has) await prisma.product.update({ where: { id: p.id }, data: { badges: cur.filter((x) => x !== id).join(",") } });
    }
  },
  canDelete: async (r) => {
    const id = String(r.id);
    for (const p of await prisma.product.findMany({ select: { id: true, badges: true } }))
      if (csvList(p.badges).includes(id)) await prisma.product.update({ where: { id: p.id }, data: { badges: csvList(p.badges).filter((x) => x !== id).join(",") } });
    return null;
  },
  revalidate: "layout",
  merch: true,
  catalog: true,
};

function parseItems(s: string): { items: { id: string; qty: number }[] } | { error: string } {
  const items: { id: string; qty: number }[] = [];
  for (const raw of s.split("\n").map((x) => x.trim()).filter(Boolean)) {
    const m = raw.match(/^(\d{1,2})\s*[x×*]\s*([A-Za-z0-9-]{2,40})$/) ?? raw.match(/^([A-Za-z0-9-]{2,40})(?:\s*[x×*]\s*(\d{1,2}))?$/);
    if (!m) return { error: `Ligne invalide : « ${raw.slice(0, 40)} » (format « 2 x REF »)` };
    const [qty, id] = /^\d/.test(m[1]) && m[2] && !/^\d+$/.test(m[2]) ? [Number(m[1]), m[2]] : [Number(m[2] ?? 1), m[1]];
    items.push({ id: id.toUpperCase(), qty: Math.max(1, Math.min(99, qty)) });
  }
  return { items };
}
const bundles: EntityDef = {
  key: "bundles",
  perm: "bundles",
  title: "Packs",
  singular: "pack",
  model: "bundle",
  idType: "int",
  intro: "Packs vendus au panier à un prix pack (page /packs). En devis, le pack est déplié en produits ; si le prix pack est inférieur à la somme des produits, la demande passe en revue par l'équipe.",
  fields: [
    { name: "title", label: "Nom du pack", type: "text", required: true, max: 80 },
    { name: "slug", label: "Slug", type: "slug", required: true, max: 60 },
    { name: "description", label: "Description", type: "textarea", max: 1000 },
    { name: "items", label: "Produits (une ligne par produit : « 2 x REF »)", type: "lines", required: true, max: 2000, rows: 5 },
    { name: "price", label: "Prix du pack TTC (DH)", type: "money", required: true, min: 1, max: 1_000_000 },
    { name: "image", label: "Image", type: "image" },
    { name: "sortOrder", label: "Ordre", type: "int", min: 0, max: 999 },
    { name: "active", label: "En vente", type: "bool" },
    { name: "seoTitle", label: "Titre SEO", type: "text", max: 70, section: "SEO" },
    { name: "seoDescription", label: "Meta description", type: "textarea", max: 170, section: "SEO" },
  ],
  columns: [
    { name: "title", label: "Pack" },
    { name: "slug", label: "Slug", kind: "mono" },
    { name: "price", label: "Prix", kind: "money" },
    { name: "active", label: "En vente", kind: "bool" },
  ],
  orderBy: [{ sortOrder: "asc" }],
  search: ["title", "slug"],
  remove: "delete",
  toForm: (r) => {
    try {
      return { ...r, items: (JSON.parse(String(r.items)) as { id: string; qty: number }[]).map((x) => `${x.qty} x ${x.id}`).join("\n") };
    } catch {
      return r;
    }
  },
  transform: async (d) => {
    const r = rules(d, "title", "description", "seoTitle", "seoDescription");
    if (r) return r;
    const p = parseItems(String(d.items ?? ""));
    if ("error" in p) return err(p.error, "items");
    if (!p.items.length) return err("Ajoutez au moins un produit", "items");
    const found = await prisma.product.findMany({ where: { id: { in: p.items.map((x) => x.id) } }, select: { id: true } });
    const missing = p.items.filter((x) => !found.some((f) => f.id === x.id)).map((x) => x.id);
    if (missing.length) return err(`Référence(s) inconnue(s) : ${missing.join(", ")}`, "items");
    d.items = JSON.stringify(p.items);
    return d;
  },
  revalidate: "layout",
  merch: true,
  publicHref: (r) => (r.active ? `/packs#${r.slug}` : null),
};

const promotions: EntityDef = {
  key: "promotions",
  perm: "promotions",
  title: "Promotions",
  singular: "promotion",
  model: "promotion",
  idType: "int",
  warning:
    "Une promotion est un CHANGEMENT DE PRIX temporaire : pendant sa période, le prix actif baisse partout (boutique, panier, commande, devis) et l'ancien prix s'affiche barré. Les devis reprennent le prix actif ligne à ligne, sans ligne ni mention « remise ».",
  fields: async () => [
    { name: "name", label: "Nom interne", type: "text", required: true, max: 80 },
    { name: "kind", label: "Type", type: "select", required: true, options: [opt("percent", "Pourcentage"), opt("fixed", "Montant fixe (DH)")] },
    { name: "value", label: "Valeur", type: "int", required: true, min: 1, max: 100000, help: "Pourcentage plafonné à 90 %. Le prix ne descend jamais sous 1 DH." },
    { name: "scope", label: "Portée", type: "select", required: true, options: [opt("product", "Produits choisis"), opt("category", "Catégories choisies"), opt("all", "Tout le catalogue")] },
    { name: "_categories", label: "Catégories", type: "multi", options: await catOptions() },
    { name: "_products", label: "Produits", type: "multi", options: await productOptions() },
    { name: "startsAt", label: "Début", type: "datetime" },
    { name: "endsAt", label: "Fin", type: "datetime" },
    { name: "active", label: "Active", type: "bool" },
  ],
  columns: [
    { name: "name", label: "Nom" },
    { name: "value", label: "Valeur", get: (r) => (r.kind === "percent" ? `${r.value} %` : `${r.value} DH`) },
    { name: "scope", label: "Portée" },
    { name: "startsAt", label: "Début", kind: "date" },
    { name: "endsAt", label: "Fin", kind: "date" },
    { name: "active", label: "Active", kind: "bool" },
  ],
  orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  search: ["name", "targets"],
  remove: "delete",
  toForm: (r) => ({ ...r, _categories: r.scope === "category" ? csvList(r.targets) : [], _products: r.scope === "product" ? csvList(r.targets) : [] }),
  transform: async (d) => {
    const r = rules(d, "name");
    if (r) return r;
    if (d.kind === "percent" && Number(d.value) > 90) return err("90 % maximum", "value");
    const t = d.scope === "category" ? csvList(d._categories) : d.scope === "product" ? csvList(d._products) : [];
    if (d.scope !== "all" && !t.length) return err("Choisissez au moins une cible", d.scope === "category" ? "_categories" : "_products");
    if (d.startsAt && d.endsAt && (d.endsAt as Date) <= (d.startsAt as Date)) return err("La fin doit suivre le début", "endsAt");
    d.targets = t.join(",");
    return d;
  },
  revalidate: "layout",
  merch: true,
  catalog: true,
};

const coupons: EntityDef = {
  key: "coupons",
  perm: "coupons",
  title: "Codes promo",
  singular: "code promo",
  model: "coupon",
  idType: "int",
  intro: "Codes saisis au panier ou au formulaire de commande. Le montant est déduit du total de la commande (libellé « Code promo »).",
  fields: [
    { name: "code", label: "Code", type: "text", required: true, max: 30, help: "Lettres, chiffres et tirets ; enregistré en majuscules." },
    { name: "kind", label: "Type", type: "select", required: true, options: [opt("percent", "Pourcentage"), opt("fixed", "Montant fixe (DH)")] },
    { name: "value", label: "Valeur", type: "int", required: true, min: 1, max: 100000 },
    { name: "minOrder", label: "Commande minimum (DH)", type: "money", min: 0, max: 10_000_000 },
    { name: "usageLimit", label: "Utilisations max. (vide = illimité)", type: "int", nullable: true, min: 1, max: 100000 },
    { name: "startsAt", label: "Début", type: "datetime" },
    { name: "endsAt", label: "Fin", type: "datetime" },
    { name: "active", label: "Actif", type: "bool" },
    { name: "note", label: "Note interne", type: "text", max: 200 },
  ],
  columns: [
    { name: "code", label: "Code", kind: "mono" },
    { name: "value", label: "Valeur", get: (r) => (r.kind === "percent" ? `${r.value} %` : `${r.value} DH`) },
    { name: "minOrder", label: "Minimum", kind: "money" },
    { name: "usedCount", label: "Utilisé", get: (r) => `${r.usedCount}${r.usageLimit ? ` / ${r.usageLimit}` : ""}` },
    { name: "endsAt", label: "Fin", kind: "date" },
    { name: "active", label: "Actif", kind: "bool" },
  ],
  orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  search: ["code", "note"],
  remove: "delete",
  transform: async (d, c) => {
    d.code = String(d.code ?? "").toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9-]{3,30}$/.test(String(d.code))) return err("Code invalide (3 à 30 lettres, chiffres ou tirets)", "code");
    const dup = await prisma.coupon.findUnique({ where: { code: String(d.code) } });
    if (dup && dup.id !== c.id) return err("Ce code existe déjà", "code");
    if (d.kind === "percent" && Number(d.value) > 90) return err("90 % maximum", "value");
    if (d.startsAt && d.endsAt && (d.endsAt as Date) <= (d.startsAt as Date)) return err("La fin doit suivre le début", "endsAt");
    return d;
  },
  revalidate: [],
};

const popups: EntityDef = {
  key: "popups",
  perm: "popups",
  title: "Popups",
  singular: "popup",
  model: "popup",
  idType: "int",
  intro: "Affichées seulement après le choix du bandeau cookies, une à la fois, avec plafond de fréquence (stocké dans le navigateur). L'inscription newsletter exige une case de consentement.",
  fields: [
    { name: "name", label: "Nom interne", type: "text", required: true, max: 80 },
    { name: "kind", label: "Type", type: "select", required: true, options: [opt("promo", "Promotion"), opt("newsletter", "Newsletter"), opt("whatsapp", "WhatsApp")] },
    { name: "title", label: "Titre", type: "text", required: true, max: 90 },
    { name: "body", label: "Texte", type: "textarea", max: 500 },
    { name: "ctaLabel", label: "Libellé du bouton", type: "text", max: 40 },
    { name: "ctaUrl", label: "Lien du bouton", type: "url", max: 300, help: "Chemin interne (/produits) ou https://… Pour WhatsApp, laissez vide : le numéro FAW est utilisé." },
    { name: "trigger", label: "Déclencheur", type: "select", required: true, options: [opt("delay", "Après un délai"), opt("scroll", "Après défilement"), opt("exit", "Intention de sortie (ordinateur)")] },
    { name: "delaySeconds", label: "Délai (s)", type: "int", min: 0, max: 600 },
    { name: "scrollPercent", label: "Défilement (%)", type: "int", min: 5, max: 100 },
    { name: "paths", label: "Pages (préfixes séparés par des virgules, vide = tout le site)", type: "text", max: 300, placeholder: "/produits, /portes-coupe-feu" },
    { name: "frequency", label: "Fréquence", type: "select", required: true, options: [opt("session", "Une fois par session"), opt("once", "Une seule fois"), opt("days", "Tous les N jours")] },
    { name: "frequencyDays", label: "N jours", type: "int", min: 1, max: 365 },
    { name: "startsAt", label: "Début", type: "datetime" },
    { name: "endsAt", label: "Fin", type: "datetime" },
    { name: "active", label: "Active", type: "bool" },
  ],
  columns: [
    { name: "name", label: "Nom" },
    { name: "kind", label: "Type" },
    { name: "trigger", label: "Déclencheur" },
    { name: "frequency", label: "Fréquence" },
    { name: "active", label: "Active", kind: "bool" },
  ],
  orderBy: [{ active: "desc" }, { updatedAt: "desc" }],
  search: ["name", "title"],
  remove: "delete",
  transform: async (d) => rules(d, "title", "body", "ctaLabel") ?? d,
  revalidate: "layout",
  merch: true,
};

const newsletter: EntityDef = {
  key: "newsletter",
  perm: "popups",
  title: "Inscrits newsletter",
  singular: "inscrit",
  model: "newsletterSubscriber",
  idType: "int",
  intro: "Adresses inscrites via une popup newsletter, avec consentement explicite. Supprimez une adresse sur demande de désinscription.",
  fields: [],
  columns: [
    { name: "email", label: "E-mail", kind: "mono" },
    { name: "consent", label: "Consentement", kind: "bool" },
    { name: "source", label: "Source" },
    { name: "createdAt", label: "Date", kind: "date" },
  ],
  orderBy: [{ createdAt: "desc" }],
  search: ["email"],
  create: false,
  edit: false,
  remove: "delete",
};

const landings: EntityDef = {
  key: "landings",
  perm: "landings",
  title: "Landing pages",
  singular: "landing page",
  model: "landingPage",
  idType: "int",
  intro: `Pages de campagne publiées sur /l/slug, composées de blocs. ${BLOCKS_HELP}`,
  fields: [
    { name: "title", label: "Titre", type: "text", required: true, max: 90 },
    { name: "slug", label: "Slug", type: "slug", required: true, max: 60, help: "Adresse publique : /l/slug" },
    { name: "blocks", label: "Blocs", type: "blocks" },
    { name: "published", label: "Publiée", type: "bool" },
    { name: "seoTitle", label: "Titre SEO", type: "text", max: 70, section: "SEO" },
    { name: "seoDescription", label: "Meta description", type: "textarea", max: 170, section: "SEO" },
  ],
  columns: [
    { name: "title", label: "Titre" },
    { name: "slug", label: "Adresse", get: (r) => `/l/${r.slug}`, kind: "mono" },
    { name: "published", label: "Publiée", kind: "bool" },
    { name: "updatedAt", label: "Modifiée", kind: "date" },
  ],
  orderBy: [{ updatedAt: "desc" }],
  search: ["title", "slug"],
  remove: "delete",
  transform: async (d) => {
    const r = rules(d, "title", "seoTitle", "seoDescription", "blocks");
    return r ?? d;
  },
  revalidate: [],
  publicHref: (r) => (r.published ? `/l/${r.slug}` : null),
};

export const RESERVED_FROM = /^\/(admin|api|_next|devis\/(suivi|pdf|confirmation))(\/|$)/;
const redirects: EntityDef = {
  key: "redirects",
  perm: "redirects",
  title: "Redirections SEO",
  singular: "redirection",
  model: "redirect",
  idType: "int",
  intro: "Redirections 301 (définitive) ou 302 (temporaire), appliquées à toutes les pages publiques (les redirections intégrées du site restent prioritaires). Import CSV : « source,destination,code » (une par ligne).",
  fields: [
    { name: "from", label: "Source (chemin)", type: "text", required: true, max: 300, placeholder: "/ancienne-page" },
    { name: "to", label: "Destination", type: "url", required: true, max: 500, placeholder: "/produits ou https://…" },
    { name: "code", label: "Type", type: "select", required: true, options: [opt("301", "301 définitive"), opt("302", "302 temporaire")] },
    { name: "active", label: "Active", type: "bool" },
    { name: "note", label: "Note", type: "text", max: 200 },
  ],
  columns: [
    { name: "from", label: "Source", kind: "mono" },
    { name: "to", label: "Destination", kind: "mono" },
    { name: "code", label: "Code" },
    { name: "active", label: "Active", kind: "bool" },
  ],
  orderBy: [{ from: "asc" }],
  search: ["from", "to", "note"],
  remove: "delete",
  toForm: (r) => ({ ...r, code: String(r.code) }),
  transform: async (d, c) => {
    const from = normalizeFrom(String(d.from ?? ""));
    if (!from) return err("Chemin source invalide (commence par /, sans domaine)", "from");
    if (RESERVED_FROM.test(from) || from === "/") return err("Chemin réservé", "from");
    if (from === d.to) return err("Source et destination identiques", "to");
    const dup = await prisma.redirect.findUnique({ where: { from } });
    if (dup && dup.id !== c.id) return err("Une redirection existe déjà pour ce chemin", "from");
    d.from = from;
    d.code = Number(d.code) === 302 ? 302 : 301;
    return d;
  },
  revalidate: [],
};
export function normalizeFrom(s: string) {
  let v = s.trim();
  try {
    if (/^https?:\/\//i.test(v)) v = new URL(v).pathname;
  } catch {
    return null;
  }
  if (!v.startsWith("/") || v.startsWith("//") || /[\s?#]/.test(v) || v.length > 300) return null;
  return v.length > 1 ? v.replace(/\/+$/, "") : v;
}

const users: EntityDef = {
  key: "users",
  perm: "users",
  title: "Utilisateurs",
  singular: "utilisateur",
  model: "adminUser",
  idType: "int",
  intro: "Comptes nominatifs du back-office (connexion par e-mail + mot de passe). Le mot de passe propriétaire (ADMIN_PASSWORD) reste l'accès de secours. Verrouillage automatique après plusieurs échecs.",
  fields: [
    { name: "email", label: "E-mail", type: "email", required: true, max: 120 },
    { name: "name", label: "Nom", type: "text", required: true, max: 80 },
    { name: "role", label: "Rôle", type: "select", required: true, options: ROLES.map((r) => opt(r, ROLE_LABEL[r])) },
    { name: "active", label: "Actif", type: "bool" },
    { name: "password", label: "Mot de passe", type: "password", max: 200, help: "12 caractères minimum. Laisser vide pour ne pas le changer. Jamais affiché ni stocké en clair." },
    { name: "_unlock", label: "Déverrouiller le compte", type: "bool" },
  ],
  columns: [
    { name: "name", label: "Nom" },
    { name: "email", label: "E-mail", kind: "mono" },
    { name: "role", label: "Rôle", get: (r) => ROLE_LABEL[r.role as keyof typeof ROLE_LABEL] ?? String(r.role) },
    { name: "active", label: "Actif", kind: "bool" },
    { name: "lockedUntil", label: "Verrouillé jusqu'à", kind: "date" },
    { name: "lastLoginAt", label: "Dernière connexion", kind: "date" },
  ],
  orderBy: [{ name: "asc" }],
  search: ["name", "email"],
  remove: "delete",
  toForm: (r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, active: r.active, password: "", _unlock: false }),
  transform: async (d, c) => {
    d.email = String(d.email ?? "").toLowerCase();
    const dup = await prisma.adminUser.findUnique({ where: { email: String(d.email) } });
    if (dup && dup.id !== c.id) return err("Cet e-mail est déjà utilisé", "email");
    const pw = String(d.password ?? "");
    delete d.password;
    if (!c.prev && pw.length < 12) return err("Mot de passe requis (12 caractères minimum)", "password");
    if (pw && pw.length < 12) return err("12 caractères minimum", "password");
    if (pw) d.passwordHash = hashPassword(pw);
    if (d._unlock) {
      d.failedCount = 0;
      d.lockedUntil = null;
    }
    return d;
  },
  revalidate: [],
};

const audit: EntityDef = {
  key: "audit",
  perm: "users",
  title: "Journal d'audit",
  singular: "entrée",
  model: "auditLog",
  idType: "int",
  intro: "Toutes les connexions et modifications du back-office (sans aucun mot de passe ni secret).",
  fields: [],
  columns: [
    { name: "at", label: "Date", kind: "date" },
    { name: "actor", label: "Auteur" },
    { name: "action", label: "Action", kind: "badge" },
    { name: "entity", label: "Module" },
    { name: "entityId", label: "Id", kind: "mono" },
    { name: "summary", label: "Détail" },
  ],
  orderBy: [{ at: "desc" }],
  search: ["actor", "action", "entity", "summary"],
  create: false,
  edit: false,
  remove: "none",
  pageSize: 100,
};

export const ENTITIES: Record<string, EntityDef> = Object.fromEntries(
  [categories, products, feeRules, shippingCities, warranties, attributes, badges, bundles, promotions, coupons, popups, newsletter, landings, redirects, users, audit].map((e) => [e.key, e]),
);
export const entityDef = (k: string) => (Object.hasOwn(ENTITIES, k) ? ENTITIES[k] : null);

/* ---------------------- Accès Prisma générique (typé large) ---------------------- */
type Delegate = {
  findMany: (a: unknown) => Promise<Row[]>;
  findUnique: (a: unknown) => Promise<Row | null>;
  count: (a: unknown) => Promise<number>;
  create: (a: unknown) => Promise<Row>;
  update: (a: unknown) => Promise<Row>;
  delete: (a: unknown) => Promise<Row>;
};
export const delegate = (e: EntityDef) => (prisma as unknown as Record<string, Delegate>)[e.model];
export const parseId = (e: EntityDef, raw: string) => (e.idType === "int" ? (/^\d{1,9}$/.test(raw) ? Number(raw) : null) : /^[A-Za-z0-9-]{2,40}$/.test(raw) ? raw : null);

export async function fieldsOf(e: EntityDef): Promise<FieldSpec[]> {
  return typeof e.fields === "function" ? e.fields() : e.fields;
}

export async function afterChange(e: EntityDef) {
  if (e.merch) invalidateMerch();
  if (e.catalog) invalidateCatalog();
}
