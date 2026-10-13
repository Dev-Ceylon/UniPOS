import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { adjustmentFor, applyMovements, isLowStock, onHandFromLedger, saleQtyChange, stockKey, stocktakeVariances, STOCK_REASONS, type StockMovementLike } from "./stock";

describe("stock ledger", () => {
  it("sums movements per variant and location", () => {
    const m = onHandFromLedger([
      { variantId: "v", locationId: "l1", qtyChange: 10, reason: "receive" },
      { variantId: "v", locationId: "l1", qtyChange: -3, reason: "sale" },
      { variantId: "v", locationId: "l2", qtyChange: 4, reason: "transfer_in" },
    ]);
    expect(m.get(stockKey("v", "l1"))).toBe(7);
    expect(m.get(stockKey("v", "l2"))).toBe(4);
    expect(() => onHandFromLedger([{ variantId: "v", locationId: "l", qtyChange: 0.5, reason: "adjust" }])).toThrow();
  });

  it("property: cached levels updated incrementally equal the ledger sum", () => {
    const mv = fc.record({
      variantId: fc.constantFrom("a", "b", "c"),
      locationId: fc.constantFrom("x", "y"),
      qtyChange: fc.integer({ min: -100, max: 100 }),
      reason: fc.constantFrom(...STOCK_REASONS),
    });
    fc.assert(
      fc.property(fc.array(fc.array(mv, { maxLength: 20 }), { maxLength: 10 }), (batches) => {
        let cache = new Map<string, number>();
        const all: StockMovementLike[] = [];
        for (const b of batches) {
          cache = applyMovements(cache, b);
          all.push(...b);
        }
        const ledger = onHandFromLedger(all);
        for (const [k, v] of ledger) expect(cache.get(k)).toBe(v);
      }),
    );
  });

  it("computes adjustments and variances", () => {
    expect(adjustmentFor(10, 7)).toBe(-3);
    expect(() => adjustmentFor(1, -1)).toThrow();
    expect(stocktakeVariances([
      { variantId: "a", expected: 5, counted: 5 },
      { variantId: "b", expected: 5, counted: 3 },
      { variantId: "c", expected: 5, counted: null },
    ])).toEqual([{ variantId: "b", expected: 5, counted: 3, variance: -2 }]);
  });

  it("flags low stock", () => {
    expect(isLowStock(2, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
    expect(isLowStock(0, null)).toBe(false);
    expect(saleQtyChange(3, true)).toBe(-3);
    expect(saleQtyChange(-2, true)).toBe(2);
    expect(saleQtyChange(3, false)).toBe(0);
  });
});
