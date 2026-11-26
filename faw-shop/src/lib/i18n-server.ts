import "server-only";
import { cookies, headers } from "next/headers";
import { DICTS, LOCALE_COOKIE, isLocale, type Locale } from "./i18n";

/** Langue : ?lang=ar|fr (URL alternative hreflang, transmise par le middleware) puis cookie. */
export async function getLocale(): Promise<Locale> {
  const h = (await headers()).get("x-faw-locale");
  if (isLocale(h)) return h;
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : "fr";
}
export async function getDict() {
  const locale = await getLocale();
  return { locale, t: DICTS[locale] };
}
