// Registre des modules du back-office (partagé client/serveur : navigation, palette Ctrl+K, permissions).
// Seuls les modules réellement implémentés figurent ici (pas d'entrée de menu fictive).

export type Level = "none" | "read" | "write";
export type Role = "admin" | "manager" | "viewer";
export const ROLES: Role[] = ["admin", "manager", "viewer"];
export const ROLE_LABEL: Record<Role, string> = { admin: "Administrateur", manager: "Gestionnaire", viewer: "Lecture seule" };

export type GroupKey = "apercu" | "ventes" | "catalogue" | "marketing" | "contenu" | "communication" | "systeme" | "parametres";
export const GROUPS: { key: GroupKey; label: string }[] = [
  { key: "apercu", label: "Aperçu" },
  { key: "ventes", label: "Ventes" },
  { key: "catalogue", label: "Catalogue" },
  { key: "marketing", label: "Marketing & SEO" },
  { key: "contenu", label: "Contenu" },
  { key: "communication", label: "Communication" },
  { key: "systeme", label: "Système" },
  { key: "parametres", label: "Paramètres" },
];

export type ModuleDef = { key: string; label: string; href: string; group: GroupKey; keywords?: string; perm?: string };

export const MODULES: ModuleDef[] = [
  { key: "dashboard", label: "Tableau de bord", href: "/admin", group: "apercu" },
  { key: "analytics", label: "Analytics", href: "/admin/analytics", group: "apercu", keywords: "ventes entonnoir conversion utm" },
  { key: "orders", label: "Demandes (commandes)", href: "/admin/commandes", group: "ventes", keywords: "commandes orders" },
  { key: "pipeline", label: "Pipeline", href: "/admin/pipeline", group: "ventes", perm: "orders" },
  { key: "devis", label: "Devis", href: "/admin/devis", group: "ventes", keywords: "quotes" },
  { key: "carts", label: "Paniers abandonnés", href: "/admin/paniers", group: "ventes", keywords: "abandoned relance whatsapp" },
  { key: "clients", label: "Clients", href: "/admin/clients", group: "ventes", keywords: "crm contacts" },
  { key: "clients-new", label: "Nouveau client / demande", href: "/admin/clients/nouveau", group: "ventes", perm: "clients" },
  { key: "products", label: "Produits", href: "/admin/m/products", group: "catalogue", keywords: "seo fiches" },
  { key: "stock", label: "Stock & prix", href: "/admin/stock", group: "catalogue", perm: "products" },
  { key: "categories", label: "Catégories", href: "/admin/m/categories", group: "catalogue" },
  { key: "fee-rules", label: "Assigner frais", href: "/admin/m/fee-rules", group: "catalogue", keywords: "livraison frais exceptions" },
  { key: "warranties", label: "Assigner garanties", href: "/admin/m/warranties", group: "catalogue" },
  { key: "attributes", label: "Attributs", href: "/admin/m/attributes", group: "catalogue", keywords: "caractéristiques spec" },
  { key: "badges", label: "Badges", href: "/admin/m/badges", group: "catalogue" },
  { key: "bundles", label: "Packs", href: "/admin/m/bundles", group: "catalogue", keywords: "bundles lots" },
  { key: "catalog-pdf", label: "Catalogue PDF", href: "/admin/catalogue-pdf", group: "catalogue" },
  { key: "promotions", label: "Promotions", href: "/admin/m/promotions", group: "marketing", keywords: "prix barré soldes" },
  { key: "coupons", label: "Codes promo", href: "/admin/m/coupons", group: "marketing", keywords: "coupons" },
  { key: "popups", label: "Popups", href: "/admin/m/popups", group: "marketing", keywords: "newsletter" },
  { key: "newsletter", label: "Inscrits newsletter", href: "/admin/m/newsletter", group: "marketing", perm: "popups" },
  { key: "landings", label: "Landing pages", href: "/admin/m/landings", group: "marketing" },
  { key: "redirects", label: "Redirections SEO", href: "/admin/m/redirects", group: "marketing", keywords: "301 302" },
  { key: "media", label: "Médiathèque", href: "/admin/medias", group: "contenu", keywords: "images upload" },
  { key: "users", label: "Utilisateurs", href: "/admin/m/users", group: "systeme", keywords: "rôles comptes" },
  { key: "permissions", label: "Rôles & permissions", href: "/admin/permissions", group: "systeme", perm: "users" },
  { key: "audit", label: "Journal d'audit", href: "/admin/m/audit", group: "systeme", perm: "users" },
  { key: "shipping-cities", label: "Villes de livraison", href: "/admin/m/shipping-cities", group: "parametres", keywords: "frais livraison" },
];

/** Clé de permission d'un module (certains partagent celle d'un autre). */
export const permKey = (m: ModuleDef) => m.perm ?? m.key;
export const PERM_KEYS = [...new Set(MODULES.map(permKey))];
export const moduleByKey = (k: string) => MODULES.find((m) => m.key === k);

const GROUP_OF = Object.fromEntries(MODULES.map((m) => [permKey(m), m.group])) as Record<string, GroupKey>;

/** Permissions par défaut : admin écrit tout ; gestionnaire hors Système ; lecture seule sans Système/Paramètres. */
export function defaultLevel(role: Role, perm: string): Level {
  const g = GROUP_OF[perm];
  if (role === "admin") return "write";
  if (role === "manager") return g === "systeme" ? "none" : g === "parametres" ? "read" : "write";
  return g === "systeme" || g === "parametres" ? "none" : "read";
}
export type PermMatrix = Partial<Record<"manager" | "viewer", Record<string, Level>>>;
export function levelFor(role: Role, perm: string, overrides: PermMatrix | null | undefined): Level {
  if (role === "admin") return "write";
  // Les utilisateurs et le journal restent réservés aux administrateurs.
  if (perm === "users") return "none";
  return overrides?.[role]?.[perm] ?? defaultLevel(role, perm);
}
