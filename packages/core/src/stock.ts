/**
 * Append-only stock ledger (ADR-005). Every movement is a row; on-hand is the
 * sum of movements per variant and location, cached in StockLevel.
 */

export const STOCK_REASONS = ["sale", "return", "adjust", "receive", "transfer_out", "transfer_in", "stocktake", "opening", "damage", "void"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export interface StockMovementLike {
  variantId: string;
  locationId: string;
  qtyChange: number;
  reason: StockReason;
}

export const stockKey = (variantId: string, locationId: string) => `${variantId}:${locationId}`;

/** Sum the ledger into on-hand quantities per variant+location. */
export function onHandFromLedger(movements: readonly StockMovementLike[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of movements) {
    if (!Number.isInteger(m.qtyChange)) throw new RangeError("qtyChange must be an integer");
    const k = stockKey(m.variantId, m.locationId);
    map.set(k, (map.get(k) ?? 0) + m.qtyChange);
  }
  return map;
}

/** Incrementally apply movements to a cached level map (what the DB does per row). */
export function applyMovements(levels: Map<string, number>, movements: readonly StockMovementLike[]): Map<string, number> {
  const next = new Map(levels);
  for (const m of movements) {
    const k = stockKey(m.variantId, m.locationId);
    next.set(k, (next.get(k) ?? 0) + m.qtyChange);
  }
  return next;
}

/** Movement needed to bring on-hand to a counted quantity (stocktake / set). */
export function adjustmentFor(onHand: number, counted: number): number {
  if (!Number.isInteger(counted) || counted < 0) throw new RangeError("Counted quantity must be a whole number ≥ 0");
  return counted - onHand;
}

export interface StocktakeLine {
  variantId: string;
  expected: number;
  counted: number | null;
}

export function stocktakeVariances(lines: readonly StocktakeLine[]) {
  return lines
    .filter((l) => l.counted !== null)
    .map((l) => ({ variantId: l.variantId, expected: l.expected, counted: l.counted!, variance: l.counted! - l.expected }))
    .filter((l) => l.variance !== 0);
}

export function isLowStock(onHand: number, reorderPoint: number | null | undefined): boolean {
  return reorderPoint != null && reorderPoint > 0 && onHand <= reorderPoint;
}

/** Signed quantity change a sale line causes (sales reduce stock, returns add). */
export function saleQtyChange(qty: number, trackStock: boolean): number {
  return trackStock ? -qty : 0;
}
