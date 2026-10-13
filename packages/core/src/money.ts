/**
 * Money is always an integer number of minor units (e.g. cents) plus a
 * currency code. Never use floats for money (ADR-003).
 */

export type Minor = number;

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "UGX", "XAF", "XOF"]);
const THREE_DECIMAL = new Set(["BHD", "KWD", "OMR", "JOD", "TND", "LYD", "IQD"]);

/** Number of decimal places used by a currency's minor unit. */
export function currencyExponent(currency: string): number {
  const c = currency.toUpperCase();
  if (ZERO_DECIMAL.has(c)) return 0;
  if (THREE_DECIMAL.has(c)) return 3;
  return 2;
}

export function assertMinor(value: number, label = "amount"): asserts value is Minor {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of minor units, got ${value}`);
  }
}

/**
 * Round a (possibly fractional) number of minor units to an integer using
 * round-half-away-from-zero, symmetric for negatives so refunds mirror sales.
 */
export function roundMinor(value: number): Minor {
  if (!Number.isFinite(value)) throw new RangeError(`Cannot round ${value}`);
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  // Guard against binary float artefacts such as 2.4999999999 for 2.5.
  const rounded = Math.floor(abs + 0.5 + 1e-9);
  return sign * rounded === 0 ? 0 : sign * rounded;
}

/** Multiply an amount by a rate in basis points (1% = 100bp), rounded. */
export function applyBasisPoints(amount: Minor, bp: number): Minor {
  return roundMinor((amount * bp) / 10_000);
}

/** Integer division with symmetric half-away-from-zero rounding. */
export function divRound(numerator: number, denominator: number): Minor {
  if (denominator === 0) throw new RangeError("Division by zero");
  return roundMinor(numerator / denominator);
}

/**
 * Split `total` across `weights` proportionally so the parts always add up to
 * exactly `total` (largest-remainder method).
 */
export function allocate(total: Minor, weights: readonly number[]): Minor[] {
  assertMinor(total, "total");
  if (weights.length === 0) return [];
  const sumW = weights.reduce((a, b) => a + Math.abs(b), 0);
  if (sumW === 0) {
    const parts = weights.map(() => 0);
    parts[0] = total;
    return parts;
  }
  const sign = total < 0 ? -1 : 1;
  const absTotal = Math.abs(total);
  const raw = weights.map((w) => (absTotal * Math.abs(w)) / sumW);
  const floors = raw.map((r) => Math.floor(r + 1e-9));
  let remainder = absTotal - floors.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r + 1e-9) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0 && order.length > 0; k = (k + 1) % order.length) {
    floors[order[k]!.i]! += 1;
    remainder -= 1;
  }
  return floors.map((f) => (f === 0 ? 0 : f * sign));
}

/** Parse a user-typed amount ("12.5", "1,250.00") into minor units. */
export function parseMoney(input: string | number, currency: string): Minor {
  const exp = currencyExponent(currency);
  const str = typeof input === "number" ? input.toFixed(exp) : input.trim().replace(/[,\s]/g, "");
  if (!/^-?\d*(\.\d*)?$/.test(str) || str === "" || str === "-" || str === ".") {
    throw new RangeError(`Invalid amount: ${input}`);
  }
  const negative = str.startsWith("-");
  const [whole = "0", frac = ""] = str.replace("-", "").split(".");
  if (frac.length > exp) {
    // round extra precision half-up
    const extra = frac.slice(exp);
    const kept = frac.slice(0, exp).padEnd(exp, "0");
    let minor = Number(whole || "0") * 10 ** exp + Number(kept || "0");
    if (Number(extra[0]) >= 5) minor += 1;
    return negative ? -minor : minor;
  }
  const minor = Number(whole || "0") * 10 ** exp + Number(frac.padEnd(exp, "0") || "0");
  return negative && minor !== 0 ? -minor : minor;
}

/** Plain decimal string ("12.50") for inputs and CSV export. */
export function toDecimalString(amount: Minor, currency: string): string {
  assertMinor(amount);
  const exp = currencyExponent(currency);
  if (exp === 0) return String(amount);
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const whole = Math.floor(abs / 10 ** exp);
  const frac = String(abs % 10 ** exp).padStart(exp, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

/** Locale-aware display string, e.g. "LKR 1,250.00" or "$12.50". */
export function formatMoney(amount: Minor, currency: string, locale = "en"): string {
  assertMinor(amount);
  const exp = currencyExponent(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: exp,
      maximumFractionDigits: exp,
    }).format(amount / 10 ** exp);
  } catch {
    return `${currency} ${toDecimalString(amount, currency)}`;
  }
}

export function sumMinor(values: readonly Minor[]): Minor {
  let s = 0;
  for (const v of values) s += v;
  return s;
}
