export const SITE = {
  name: "FAW Aluminium",
  tagline: "la fiabilité à la perfection",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3100").replace(/\/$/, ""),
  whatsappNumber: "212660121813",
  whatsappDisplay: "+212 660 121 813",
  phone: "+212 522 865 202",
  phoneHref: "tel:+212522865202",
  email: "faw@faw.ma",
  address: "21 Rue Al Yazidi Mohamed, Casablanca",
  /** Dépôt / retrait des marchandises (le bureau reste rue Al Yazidi). */
  depotAddress: "ZI Lakhyayta, RN1 km 22, route d'El Jadida, Lakhyayta (Casablanca)",
  mapsUrl: "https://maps.app.goo.gl/1Q2ZzBvZiVWDH2vK6",
  wazeUrl: "https://waze.com/ul?ll=33.5703256,-7.6155826&navigate=yes",
  geo: { lat: 33.5703256, lng: -7.6155826 },
  hours: "Lundi–vendredi 9h–17h · samedi 9h–12h",
  /** Page Facebook existante (déjà publiée en v3). Instagram / LinkedIn : uniquement via variables d'environnement. */
  facebookUrl: "https://www.facebook.com/profile.php?id=61560516980314",
} as const;

export type SocialLink = { key: "instagram" | "linkedin" | "facebook"; label: string; url: string };

/** Lecture runtime (clé dynamique : pas d'inlining au build des NEXT_PUBLIC_*). Côté serveur uniquement. */
export function runtimeEnv(name: string): string | undefined {
  const v = typeof process !== "undefined" ? process.env[name] : undefined;
  return v && v.trim() ? v.trim() : undefined;
}

function validSocial(raw: string | undefined, hosts: string[]) {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return null;
    const host = u.hostname.replace(/^www\./, "");
    return hosts.includes(host) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Réseaux sociaux affichés : Instagram et LinkedIn seulement si NEXT_PUBLIC_INSTAGRAM_URL / NEXT_PUBLIC_LINKEDIN_URL
 * sont définies (lues au runtime côté serveur). Aucune URL devinée.
 */
export function socialLinks(): SocialLink[] {
  const out: SocialLink[] = [];
  const ig = validSocial(runtimeEnv("NEXT_PUBLIC_INSTAGRAM_URL"), ["instagram.com"]);
  const li = validSocial(runtimeEnv("NEXT_PUBLIC_LINKEDIN_URL"), ["linkedin.com"]);
  if (ig) out.push({ key: "instagram", label: "Instagram", url: ig });
  if (li) out.push({ key: "linkedin", label: "LinkedIn", url: li });
  return out;
}

export function waLink(text?: string) {
  const base = `https://wa.me/${SITE.whatsappNumber}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
