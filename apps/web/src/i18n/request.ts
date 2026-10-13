import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const LOCALES = ["en", "si", "ta"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", si: "සිංහල", ta: "தமிழ்" };

export default getRequestConfig(async () => {
  const store = await cookies();
  const c = store.get("NEXT_LOCALE")?.value;
  const locale: Locale = (LOCALES as readonly string[]).includes(c ?? "") ? (c as Locale) : "en";
  const en = (await import("../../messages/en.json")).default;
  const messages = locale === "en" ? en : deepMerge(en, (await import(`../../messages/${locale}.json`)).default);
  return { locale, messages, timeZone: "Asia/Colombo" };
});

/** Fall back to English for any key a translation is missing. */
function deepMerge(base: Record<string, unknown>, over: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? deepMerge((base[k] as Record<string, unknown>) ?? {}, v as Record<string, unknown>) : v;
  }
  return out;
}
