import type { Minor } from "./money";

export interface ShiftCashInputs {
  openingFloat: Minor;
  cashSales: Minor; // net cash received for sales (after change)
  cashRefunds: Minor; // positive amount paid out for refunds
  cashIn: Minor;
  cashOut: Minor;
}

export function expectedCash(i: ShiftCashInputs): Minor {
  return i.openingFloat + i.cashSales - i.cashRefunds + i.cashIn - i.cashOut;
}

export function cashVariance(expected: Minor, counted: Minor): Minor {
  return counted - expected;
}

/** Sum a denomination count ({ 500000: 2, 10000: 3 }) into minor units. */
export function countDenominations(counts: Record<string, number>): Minor {
  let total = 0;
  for (const [denom, n] of Object.entries(counts)) {
    const d = Number(denom);
    if (!Number.isInteger(d) || !Number.isInteger(n) || n < 0) throw new RangeError("Invalid denomination count");
    total += d * n;
  }
  return total;
}
