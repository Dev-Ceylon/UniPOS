import type { Minor } from "./money";

export interface LoyaltyRules {
  enabled: boolean;
  /** Points earned per whole currency unit spent (e.g. 1 point per 100 LKR → earnPerMinor = 10000). */
  spendPerPoint: Minor;
  /** Value of one point in minor units when redeemed. */
  pointValue: Minor;
  /** Minimum balance before points can be redeemed. */
  minRedeem: number;
}

export const DEFAULT_LOYALTY: LoyaltyRules = { enabled: false, spendPerPoint: 10000, pointValue: 100, minRedeem: 100 };

export function pointsEarned(paidTotal: Minor, rules: LoyaltyRules): number {
  if (!rules.enabled || rules.spendPerPoint <= 0) return 0;
  const sign = paidTotal < 0 ? -1 : 1;
  const pts = Math.floor(Math.abs(paidTotal) / rules.spendPerPoint);
  return pts === 0 ? 0 : sign * pts;
}

export function pointsValue(points: number, rules: LoyaltyRules): Minor {
  return points * rules.pointValue;
}

/** Points needed to pay `amount` (rounded up), validated against balance. */
export function pointsForAmount(amount: Minor, balance: number, rules: LoyaltyRules): number {
  if (!rules.enabled) throw new RangeError("Loyalty is disabled");
  if (balance < rules.minRedeem) throw new RangeError(`At least ${rules.minRedeem} points are needed to redeem`);
  const pts = Math.ceil(amount / rules.pointValue);
  if (pts > balance) throw new RangeError("Not enough points");
  return pts;
}

export function balanceFromLedger(entries: readonly { points: number }[]): number {
  return entries.reduce((a, e) => a + e.points, 0);
}
