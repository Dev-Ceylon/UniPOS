import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeCart, discountRatioBp, lineGross, type CartLineInput } from "./cart";
import type { TaxRule } from "./tax";

const vat: TaxRule = { id: "vat", name: "VAT", rateBp: 1800, inclusive: true, compound: false };
const line = (o: Partial<CartLineInput> = {}): CartLineInput => ({ id: "l1", variantId: "v1", name: "Tea", qty: 1, unitPrice: 1000, taxRules: [vat], ...o });

describe("cart", () => {
  it("computes a simple inclusive cart", () => {
    const t = computeCart({ lines: [line({ qty: 3 })] });
    expect(t.subtotal).toBe(3000);
    expect(t.total).toBe(3000);
    expect(t.taxTotal).toBe(458);
    expect(t.netTotal).toBe(2542);
    expect(t.itemCount).toBe(3);
  });

  it("applies modifiers, line and order discounts", () => {
    const t = computeCart({
      lines: [
        line({ qty: 2, modifiers: [{ name: "Extra shot", priceDelta: 200 }], discount: { type: "percent", valueBp: 1000 } }),
        line({ id: "l2", variantId: "v2", unitPrice: 500, discount: { type: "amount", value: 100 }, taxRules: [] }),
      ],
      orderDiscount: { type: "amount", value: 260 },
    });
    expect(t.lines[0]!.gross).toBe(2400);
    expect(t.lines[0]!.lineDiscount).toBe(240);
    expect(t.lines[1]!.lineDiscount).toBe(100);
    expect(t.lines[0]!.orderDiscount + t.lines[1]!.orderDiscount).toBe(260);
    expect(t.discountTotal).toBe(600);
    expect(t.total).toBe(2400 + 500 - 600);
    expect(t.inclusiveTaxTotal).toBeGreaterThan(0);
    expect(t.exclusiveTaxTotal).toBe(0);
  });

  it("caps amount discounts at the line value", () => {
    const t = computeCart({ lines: [line({ discount: { type: "amount", value: 5000 } })] });
    expect(t.total).toBe(0);
  });

  it("rejects bad input", () => {
    expect(() => lineGross({ qty: 1.5, unitPrice: 100 })).toThrow();
    expect(() => computeCart({ lines: [line({ discount: { type: "percent", valueBp: 20000 } })] })).toThrow();
    expect(() => computeCart({ lines: [line({ discount: { type: "amount", value: -1 } })] })).toThrow();
  });

  it("handles negative (return) lines", () => {
    const t = computeCart({ lines: [line({ qty: -2, discount: { type: "percent", valueBp: 5000 } })] });
    expect(t.total).toBe(-1000);
    expect(t.discountTotal).toBe(-1000);
  });

  it("reports discount ratio", () => {
    expect(discountRatioBp({ subtotal: 1000, discountTotal: 250 })).toBe(2500);
    expect(discountRatioBp({ subtotal: 0, discountTotal: 0 })).toBe(0);
  });

  it("totals always equal the sum of line totals and amounts reconcile", () => {
    const lineArb = fc.record({
      qty: fc.integer({ min: 1, max: 20 }),
      unitPrice: fc.integer({ min: 0, max: 100000 }),
      pct: fc.option(fc.integer({ min: 0, max: 10000 }), { nil: undefined }),
      inclusive: fc.boolean(),
      rate: fc.integer({ min: 0, max: 3000 }),
    });
    fc.assert(
      fc.property(fc.array(lineArb, { minLength: 1, maxLength: 8 }), fc.integer({ min: 0, max: 10000 }), (ls, orderPct) => {
        const t = computeCart({
          lines: ls.map((l, i) =>
            line({
              id: `l${i}`,
              qty: l.qty,
              unitPrice: l.unitPrice,
              discount: l.pct === undefined ? null : { type: "percent", valueBp: l.pct },
              taxRules: [{ id: "t", name: "T", rateBp: l.rate, inclusive: l.inclusive, compound: false }],
            }),
          ),
          orderDiscount: { type: "percent", valueBp: orderPct },
        });
        expect(t.total).toBe(t.lines.reduce((a, l) => a + l.total, 0));
        expect(t.subtotal - t.discountTotal + t.exclusiveTaxTotal).toBe(t.total);
        expect(t.netTotal + t.taxTotal).toBe(t.total);
        expect(t.total).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});
