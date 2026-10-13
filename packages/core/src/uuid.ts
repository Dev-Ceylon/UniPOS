/**
 * UUIDv7 (RFC 9562): 48-bit unix ms timestamp + random. Generated on the
 * client so offline sales get final, time-ordered IDs before sync (ADR-006).
 */

let lastMs = 0;
let seq = 0;

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return b;
}

export function uuidv7(now: number = Date.now()): string {
  // monotonic within the same millisecond using a 12-bit counter in rand_a
  if (now === lastMs) {
    seq = (seq + 1) & 0xfff;
    if (seq === 0) now = ++lastMs;
  } else {
    lastMs = now;
    seq = randomBytes(2).reduce((a, b) => (a << 8) | b, 0) & 0x3ff;
  }
  const bytes = randomBytes(16);
  const ts = BigInt(now);
  for (let i = 0; i < 6; i++) bytes[i] = Number((ts >> BigInt(8 * (5 - i))) & 0xffn);
  bytes[6] = 0x70 | ((seq >> 8) & 0x0f);
  bytes[7] = seq & 0xff;
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(v: string): boolean {
  return UUID_RE.test(v);
}

export function uuidv7Timestamp(id: string): number {
  return parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}
