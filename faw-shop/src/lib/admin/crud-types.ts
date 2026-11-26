// Description sérialisable des champs (envoyée au formulaire client). Aucune fonction, aucun secret.
export type FieldType =
  | "text" | "textarea" | "markdown" | "int" | "money" | "bool" | "select" | "multi"
  | "datetime" | "image" | "slug" | "password" | "blocks" | "lines" | "url" | "email" | "color";

export type Option = { value: string; label: string };

export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Valeur vide autorisée pour un nombre (enregistrée null). */
  nullable?: boolean;
  help?: string;
  max?: number;
  min?: number;
  options?: Option[];
  placeholder?: string;
  /** Modifiable seulement à la création (clé, référence). */
  createOnly?: boolean;
  /** Section du formulaire (titre de groupe). */
  section?: string;
  rows?: number;
};

export type CrudState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

/* ---------- Blocs (landing pages, pages techniques, accueil) ---------- */
export type Block =
  | { type: "hero"; title: string; subtitle?: string; ctaLabel?: string; ctaUrl?: string; image?: string }
  | { type: "products"; title?: string; ids: string[] }
  | { type: "text"; title?: string; body: string }
  | { type: "faq"; title?: string; items: { q: string; a: string }[] }
  | { type: "cta"; title: string; text?: string; label: string; url: string };
export const BLOCK_TYPES: { type: Block["type"]; label: string }[] = [
  { type: "hero", label: "Bandeau (hero)" },
  { type: "products", label: "Grille de produits" },
  { type: "text", label: "Texte" },
  { type: "faq", label: "FAQ" },
  { type: "cta", label: "Appel à l'action" },
];
