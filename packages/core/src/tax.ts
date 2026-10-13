/**
 * Tax engine (ADR-004): a pure function. Rules in, line taxes out.
 * Runs identically on the server and on the offline client.
 */
import { type Minor, roundMinor } from "./money";

export interface TaxRule {
  id: string;
  name: string;
  /** Rate in basis points: 15% = 1500. */
  rateBp: number;
  /** Price already includes this tax. */
  inclusive: boolean;
  /** Applied on top of the base plus previous taxes in the same group. */
  compound: boolean;
  /** Lower runs first. */
  priority?: number;
}

export interface TaxLine {
  ruleId: string;
  name: string;
  rateBp: number;
  inclusive: boolean;
  amount: Minor;
}

export interface LineTaxResult {
  /** Amount excluding all taxes. */
  net: Minor;
  /** Taxes in rule order. */
  taxes: TaxLine[];
  /** Inclusive tax portion (already inside the price). */
  inclusiveTax: Minor;
  /** Exclusive tax to add on top of the price. */
  exclusiveTax: Minor;
  /** What the customer pays for this line. */
  total: Minor;
}

function sortRules(rules: readonly TaxRule[]): TaxRule[] {
  return [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id));
}

/** Unrounded taxes for a given base, honouring compounding. */
function rawTaxes(base: number, rules: readonly TaxRule[]): number[] {
  const out: number[] = [];
  let running = 0;
  for (const r of rules) {
    const t = r.compound ? ((base + running) * r.rateBp) / 10_000 : (base * r.rateBp) / 10_000;
    out.push(t);
    running += t;
  }
  return out;
}

/** Rounded taxes for a base, rounding each tier on the rounded previous tiers. */
function roundedTaxes(base: Minor, rules: readonly TaxRule[]): Minor[] {
  const out: Minor[] = [];
  let running = 0;
  for (const r of rules) {
    const t = roundMinor(((r.compound ? base + running : base) * r.rateBp) / 10_000);
    out.push(t);
    running += t;
  }
  return out;
}

export function validateRules(rules: readonly TaxRule[]): void {
  for (const r of rules) {
    if (!Number.isInteger(r.rateBp) || r.rateBp < 0 || r.rateBp > 100_000) {
      throw new RangeError(`Tax rule ${r.name}: rateBp must be an integer between 0 and 100000`);
    }
  }
}

/**
 * Compute taxes for one line.
 *
 * `amount` is the line amount after discounts, in minor units, as shown on the
 * shelf: it already contains inclusive taxes and excludes exclusive ones.
 * Negative amounts (returns) are computed on the absolute value and mirrored so
 * a refund always reverses the original taxes exactly.
 */
export function calculateLineTax(amount: Minor, rules: readonly TaxRule[]): LineTaxResult {
  validateRules(rules);
  if (amount < 0) {
    const pos = calculateLineTax(-amount, rules);
    const neg = (v: number) => (v === 0 ? 0 : -v);
    return {
      net: neg(pos.net),
      taxes: pos.taxes.map((t) => ({ ...t, amount: neg(t.amount) })),
      inclusiveTax: neg(pos.inclusiveTax),
      exclusiveTax: neg(pos.exclusiveTax),
      total: neg(pos.total),
    };
  }
  const sorted = sortRules(rules);
  const inclusive = sorted.filter((r) => r.inclusive);
  const exclusive = sorted.filter((r) => !r.inclusive);

  // 1. Extract inclusive taxes from the price so net + inclusive == amount exactly.
  let net = amount;
  let inclusiveAmounts: Minor[] = [];
  if (inclusive.length > 0) {
    const SCALE = 1_000_000;
    const factor = (SCALE + rawTaxes(SCALE, inclusive).reduce((a, b) => a + b, 0)) / SCALE;
    net = roundMinor(amount / factor);
    inclusiveAmounts = roundedTaxes(net, inclusive);
    const residual = amount - net - inclusiveAmounts.reduce((a, b) => a + b, 0);
    if (residual !== 0) {
      // put the rounding residual on the largest tier
      let idx = 0;
      inclusiveAmounts.forEach((v, i) => {
        if (v > inclusiveAmounts[idx]!) idx = i;
      });
      inclusiveAmounts[idx]! += residual;
    }
  }

  // 2. Add exclusive taxes on the net amount.
  const exclusiveAmounts = roundedTaxes(net, exclusive);

  const taxes: TaxLine[] = [
    ...inclusive.map((r, i) => ({ ruleId: r.id, name: r.name, rateBp: r.rateBp, inclusive: true, amount: inclusiveAmounts[i]! })),
    ...exclusive.map((r, i) => ({ ruleId: r.id, name: r.name, rateBp: r.rateBp, inclusive: false, amount: exclusiveAmounts[i]! })),
  ];
  const inclusiveTax = inclusiveAmounts.reduce((a, b) => a + b, 0);
  const exclusiveTax = exclusiveAmounts.reduce((a, b) => a + b, 0);
  return { net, taxes, inclusiveTax, exclusiveTax, total: amount + exclusiveTax };
}

/** Sum tax lines by rule across many lines (for receipts and tax reports). */
export function summarizeTaxes(lines: readonly TaxLine[][]): TaxLine[] {
  const map = new Map<string, TaxLine>();
  for (const taxes of lines) {
    for (const t of taxes) {
      const prev = map.get(t.ruleId);
      if (prev) prev.amount += t.amount;
      else map.set(t.ruleId, { ...t });
    }
  }
  return [...map.values()];
}

/** Choose rules applicable to a location's tax region (rules without region apply everywhere). */
export function rulesForRegion<T extends TaxRule & { region?: string | null }>(rules: readonly T[], region?: string | null): T[] {
  return rules.filter((r) => !r.region || !region || r.region === region);
}
