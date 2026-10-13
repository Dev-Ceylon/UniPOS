import { assertMinor, type Minor } from "./money";

export const TENDERS = ["cash", "card", "wallet", "gift_card", "points", "other"] as const;
export type Tender = (typeof TENDERS)[number];

export interface PaymentInput {
  tender: Tender;
  amount: Minor;
  reference?: string | null;
}

export interface TenderSummary {
  paid: Minor;
  remaining: Minor;
  change: Minor;
  /** Payments with the change already taken off the cash tenders. */
  settled: PaymentInput[];
  complete: boolean;
}

/**
 * Apply split tenders to a total. Only cash may exceed what is owed (change is
 * given back from cash); other tenders cannot overpay.
 */
export function settleTenders(total: Minor, payments: readonly PaymentInput[]): TenderSummary {
  assertMinor(total, "total");
  const sign = total < 0 ? -1 : 1;
  const owed = Math.abs(total);
  let nonCash = 0;
  let cash = 0;
  for (const p of payments) {
    assertMinor(p.amount, "payment");
    if (p.amount * sign < 0) throw new RangeError("Payment sign must match the sale total");
    if (p.tender === "cash") cash += Math.abs(p.amount);
    else nonCash += Math.abs(p.amount);
  }
  if (nonCash > owed) throw new RangeError("Non-cash tenders cannot exceed the amount due");
  const paid = cash + nonCash;
  const change = sign > 0 ? Math.max(0, paid - owed) : 0;
  if (sign < 0 && paid > owed) throw new RangeError("Refund payments exceed the refund total");
  const remaining = Math.max(0, owed - paid);
  // Take change back off the cash tenders (last first)
  let toRemove = change;
  const settled = [...payments].reverse().map((p) => {
    if (toRemove > 0 && p.tender === "cash") {
      const take = Math.min(toRemove, p.amount);
      toRemove -= take;
      return { ...p, amount: p.amount - take };
    }
    return { ...p };
  });
  settled.reverse();
  return {
    paid: paid * sign,
    remaining: remaining === 0 ? 0 : remaining * sign,
    change,
    settled: settled.filter((p) => p.amount !== 0),
    complete: remaining === 0,
  };
}

/** Quick cash buttons: exact, then next round notes. */
export function quickCashOptions(due: Minor, notes: readonly Minor[] = [100, 500, 1000, 2000, 5000, 10000, 50000, 100000, 500000]): Minor[] {
  if (due <= 0) return [];
  const opts = new Set<Minor>([due]);
  for (const n of notes) {
    const rounded = Math.ceil(due / n) * n;
    if (rounded > due) opts.add(rounded);
    if (opts.size >= 4) break;
  }
  return [...opts].sort((a, b) => a - b);
}
