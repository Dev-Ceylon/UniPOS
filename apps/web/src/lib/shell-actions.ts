"use server";
import { PinSchema } from "@unipos/core";
import { getPrisma, withTenant, writeAudit } from "@unipos/db";
import { cookies } from "next/headers";
import { CASHIER_COOKIE, getAppContext, LOCATION_COOKIE } from "./context";
import { MAX_PIN_ATTEMPTS, PIN_LOCK_MINUTES, signCashier, verifyPin } from "./pin";
import { rateLimit } from "./rate-limit";

const YEAR = 60 * 60 * 24 * 365;

export async function setLocation(locationId: string) {
  const ctx = await getAppContext();
  if (!ctx || !ctx.locations.some((l) => l.id === locationId)) return { ok: false as const };
  (await cookies()).set(LOCATION_COOKIE, locationId, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true });
  return { ok: true as const };
}

export async function setThemePref(theme: "light" | "dark" | "system") {
  const store = await cookies();
  if (theme === "system") store.delete("unipos_theme");
  else store.set("unipos_theme", theme, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function setLocalePref(locale: string) {
  if (!["en", "si", "ta"].includes(locale)) return;
  (await cookies()).set("NEXT_LOCALE", locale, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

/**
 * Fast cashier switching with a 4–6 digit PIN. Locks a member after 5 wrong
 * tries (ADR-012, security checklist).
 */
export async function switchCashier(pin: string): Promise<{ ok: true; name: string; memberId: string } | { ok: false; error: string }> {
  const ctx = await getAppContext();
  if (!ctx) return { ok: false, error: "Please sign in again." };
  if (!PinSchema.safeParse(pin).success) return { ok: false, error: "PIN must be 4–6 digits" };
  if (!rateLimit(`pin:${ctx.tenantId}:${ctx.sessionMemberId}`, 10, 0.2)) return { ok: false, error: "Too many attempts. Wait a minute." };
  const prisma = getPrisma();
  const members = await prisma.member.findMany({ where: { tenantId: ctx.tenantId, active: true, pinHash: { not: null } }, include: { user: true } });
  const now = new Date();
  for (const m of members) {
    if (m.pinLockedUntil && m.pinLockedUntil > now) continue;
    if (await verifyPin(pin, m.pinHash)) {
      await prisma.member.update({ where: { id: m.id }, data: { failedPinAttempts: 0, pinLockedUntil: null } });
      (await cookies()).set(CASHIER_COOKIE, signCashier(m.id, ctx.tenantId), { path: "/", httpOnly: true, sameSite: "lax", maxAge: 12 * 3600, secure: process.env.NODE_ENV === "production" });
      await withTenant(ctx.tenantId, (tx) => writeAudit(tx, { memberId: m.id, name: m.displayName || m.user.name }, "cashier.switch", "Member", m.id));
      return { ok: true, name: m.displayName || m.user.name, memberId: m.id };
    }
  }
  // Wrong PIN: count the attempt against the member currently at the till.
  const target = await prisma.member.findUnique({ where: { id: ctx.member.id } });
  if (target) {
    const attempts = target.failedPinAttempts + 1;
    await prisma.member.update({
      where: { id: target.id },
      data: { failedPinAttempts: attempts >= MAX_PIN_ATTEMPTS ? 0 : attempts, pinLockedUntil: attempts >= MAX_PIN_ATTEMPTS ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) : undefined },
    });
    if (attempts >= MAX_PIN_ATTEMPTS) {
      await withTenant(ctx.tenantId, (tx) => writeAudit(tx, { memberId: target.id }, "pin.locked", "Member", target.id));
      return { ok: false, error: `Too many wrong PINs. PIN locked for ${PIN_LOCK_MINUTES} minutes.` };
    }
  }
  return { ok: false, error: "Wrong PIN" };
}

export async function endCashierSession() {
  (await cookies()).delete(CASHIER_COOKIE);
}
