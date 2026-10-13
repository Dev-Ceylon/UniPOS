/**
 * Returns are a Sale with negative lines linked to the original. These helpers
 * guarantee a refund never exceeds what was sold.
 */
import { allocate, type Minor } from "./money";
import type { TaxLine } from "./tax";

export interface SoldLine {
  id: string;
  qty: number;
  total: Minor;
  net: Minor;
  taxes: TaxLine[];
  discount: Minor;
}

export interface RefundedLine {
  originalLineId: string;
  qty: number; // positive quantity already refunded
}

export function refundableQuantities(sold: readonly SoldLine[], previous: readonly RefundedLine[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const l of sold) out.set(l.id, l.qty);
  for (const r of previous) out.set(r.originalLineId, (out.get(r.originalLineId) ?? 0) - Math.abs(r.qty));
  return out;
}

export interface RefundRequestLine {
  originalLineId: string;
  qty: number;
}

export interface RefundLineResult {
  originalLineId: string;
  qty: number; // negative
  total: Minor; // negative
  net: Minor;
  discount: Minor;
  taxes: TaxLine[];
}

/** Portion of `amount` for `part` units out of `whole`, consistent across partial refunds. */
function portion(amount: Minor, whole: number, alreadyUnits: number, part: number): Minor {
  // amount allocated to units [alreadyUnits, alreadyUnits+part) of `whole`
  const upTo = (n: number) => (n >= whole ? amount : Math.floor((amount * n) / whole));
  return upTo(alreadyUnits + part) - upTo(alreadyUnits);
}

/**
 * Build negative refund lines. Amounts are pro-rated from the original line so
 * refunding every unit (in one go or many) returns exactly the original total.
 */
export function buildRefundLines(sold: readonly SoldLine[], previous: readonly RefundedLine[], request: readonly RefundRequestLine[]): RefundLineResult[] {
  const remaining = refundableQuantities(sold, previous);
  const already = new Map<string, number>();
  for (const r of previous) already.set(r.originalLineId, (already.get(r.originalLineId) ?? 0) + Math.abs(r.qty));
  const out: RefundLineResult[] = [];
  for (const req of request) {
    if (!Number.isInteger(req.qty) || req.qty <= 0) throw new RangeError("Refund quantity must be a positive whole number");
    const line = sold.find((l) => l.id === req.originalLineId);
    if (!line) throw new RangeError(`Line ${req.originalLineId} is not part of the original sale`);
    const left = remaining.get(line.id) ?? 0;
    if (req.qty > left) throw new RangeError(`Cannot refund ${req.qty}; only ${left} left on this line`);
    const done = already.get(line.id) ?? 0;
    const total = portion(line.total, line.qty, done, req.qty);
    const net = portion(line.net, line.qty, done, req.qty);
    const discount = portion(line.discount, line.qty, done, req.qty);
    const taxes = line.taxes.map((t) => ({ ...t, amount: -portion(t.amount, line.qty, done, req.qty) }));
    remaining.set(line.id, left - req.qty);
    already.set(line.id, done + req.qty);
    out.push({ originalLineId: line.id, qty: -req.qty, total: -total, net: -net, discount: -discount, taxes });
  }
  return out;
}

/** Split a refund total back across original tenders (largest first), capped per tender. */
export function refundTenders(refundTotal: Minor, original: readonly { tender: string; amount: Minor }[]): { tender: string; amount: Minor }[] {
  const abs = Math.abs(refundTotal);
  const paid = original.reduce((a, p) => a + p.amount, 0);
  if (abs > paid) throw new RangeError("Refund exceeds amount paid");
  const parts = allocate(
    abs,
    original.map((p) => p.amount),
  );
  return original.map((p, i) => ({ tender: p.tender, amount: -parts[i]! })).filter((p) => p.amount !== 0);
}
