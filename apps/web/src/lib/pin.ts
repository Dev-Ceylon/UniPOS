import "server-only";
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { env } from "./env";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPin(pin: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(pin, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;

/** Signed cashier token: memberId.tenantId.expires.signature */
export function signCashier(memberId: string, tenantId: string, ttlMs = 12 * 3600_000): string {
  const exp = Date.now() + ttlMs;
  const body = `${memberId}.${tenantId}.${exp}`;
  const sig = createHmac("sha256", env.secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCashier(token: string | undefined, tenantId: string): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [memberId, tid, exp, sig] = parts as [string, string, string, string];
  const expected = createHmac("sha256", env.secret).update(`${memberId}.${tid}.${exp}`).digest("base64url");
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (tid !== tenantId || Number(exp) < Date.now()) return null;
  return memberId;
}
