import { formatMoney as fm } from "@unipos/core";

export function money(amount: number, currency: string, locale = "en") {
  return fm(amount, currency, locale === "si" ? "si-LK" : locale === "ta" ? "ta-LK" : "en-LK");
}

export function dateTime(d: Date | string, timeZone: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone }).format(typeof d === "string" ? new Date(d) : d);
}

export function dateOnly(d: Date | string, timeZone: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(typeof d === "string" ? new Date(d) : d);
}

/** Start of day in a time zone, as a UTC Date. */
export function startOfDayInZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return zonedToUtc(`${parts}T00:00:00`, timeZone);
}

/** Interpret a local wall-clock time ("2027-01-10T00:00:00") in a zone as UTC. */
export function zonedToUtc(local: string, timeZone: string): Date {
  const asUtc = new Date(`${local}Z`);
  const tzTime = new Date(asUtc.toLocaleString("en-US", { timeZone }));
  const utcTime = new Date(asUtc.toLocaleString("en-US", { timeZone: "UTC" }));
  return new Date(asUtc.getTime() - (tzTime.getTime() - utcTime.getTime()));
}

export function ymd(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
