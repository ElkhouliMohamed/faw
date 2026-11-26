"use server";

import { z } from "zod";

import { spamCheck } from "@/lib/security";
import { waLink } from "@/lib/site";

export type BotLeadState = { ok: true; wa: string } | { ok: false; message: string; errors?: Record<string, string> } | null;

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(80),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.()-]/g, ""))
    .refine((v) => /^(\+212|00212|0)[5-7]\d{8}$/.test(v), "Numéro marocain invalide (ex. 06 12 34 56 78)"),
  topic: z.string().trim().max(200).optional().default(""),
  locale: z.enum(["fr", "ar"]).default("fr"),
});

/** Assistant du site : enregistre le contact (source « bot ») puis renvoie un lien WhatsApp pré-rempli. Rien n'est envoyé automatiquement. */
export async function botLead(_prev: BotLeadState, fd: FormData): Promise<BotLeadState> {
  const spam = await spamCheck(fd, "bot");
  if (!spam.ok) return { ok: false, message: spam.message };
  const parsed = schema.safeParse({ name: fd.get("name") ?? "", phone: fd.get("phone") ?? "", topic: fd.get("topic") ?? "", locale: fd.get("locale") || "fr" });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const i of parsed.error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
    return { ok: false, message: "Vérifiez les champs.", errors };
  }
  const v = parsed.data;
  const topic = v.topic.replace(/[\r\n]+/g, " ").slice(0, 200);
  const response=await fetch(`${process.env.LARAVEL_ORIGIN||"http://127.0.0.1:8000"}/api/contacts`,{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({kind:"bot",name:v.name,phone:v.phone,subject:"Assistant du site",message:topic||"Demande de rappel via l’assistant du site."}),cache:"no-store",signal:AbortSignal.timeout(10000)}).catch(()=>null);
  if(!response?.ok)return {ok:false,message:"La demande n’a pas été enregistrée. Merci de réessayer."};
  const msg = `Bonjour Walfar, je suis ${v.name}.${topic ? ` ${topic}.` : ""} Pouvez-vous me rappeler au ${v.phone} ?`;
  return { ok: true, wa: waLink(msg) };
}
