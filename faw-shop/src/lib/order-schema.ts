import { z } from "zod";

const optional = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const orderSchema = z
  .object({
    customerName: z.string().trim().min(2, "Nom requis").max(120),
    phone: z
      .string()
      .trim()
      .transform((v) => v.replace(/[\s.()-]/g, ""))
      .refine((v) => /^(\+212|00212|0)[5-7]\d{8}$/.test(v) || /^\+?\d{9,15}$/.test(v), "Numéro de téléphone invalide"),
    email: z.string().trim().min(1, "E-mail requis pour recevoir le devis").max(160).email("E-mail invalide"),
    city: z.string().trim().min(2, "Ville requise").max(80),
    address: optional(300),
    company: optional(160),
    ice: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\s/g, "") : undefined))
      .refine((v) => !v || /^\d{15}$/.test(v), "L'ICE comporte 15 chiffres"),
    paymentMethod: z.enum(["virement", "cheque", "reception"], { message: "Choisissez un mode de paiement" }),
    deliveryMode: z.string().regex(/^[a-z0-9-]{2,40}$/, "Mode de livraison non disponible"),
    notes: optional(1000),
    items: z
      .array(z.object({ id: z.string().max(90), qty: z.number().int().min(1).max(99) }))
      .min(1, "Panier vide")
      .max(40),
    locale: z.enum(["fr", "ar"]).default("fr"),
  })
  .superRefine((v, ctx) => {
    if (v.deliveryMode !== "retrait" && (!v.address || v.address.length < 5))
      ctx.addIssue({ code: "custom", path: ["address"], message: "Adresse de livraison requise" });
  });

export type OrderInput = z.input<typeof orderSchema>;
