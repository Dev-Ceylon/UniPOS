import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildRefundLines, refundableQuantities, refundTenders, type SoldLine } from "./refunds";

const sold: SoldLine[] = [
  { id: "a", qty: 3, total: 1000, net: 847, discount: 0, taxes: [{ ruleId: "vat", name: "VAT", rateBp: 1800, inclusive: true, amount: 153 }] },
  { id: "b", qty: 1, total: 500, net: 500, discount: 50, taxes: [] },
];

describe("refunds", () => {
  it("tracks refundable quantities", () => {
    const m = refundableQuantities(sold, [{ originalLineId: "a", qty: -1 }]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(1);
  });

  it("pro-rates partial refunds and sums back to the original", () => {
    const first = buildRefundLines(sold, [], [{ originalLineId: "a", qty: 1 }]);
    expect(first[0]!.qty).toBe(-1);
    expect(first[0]!.total).toBe(-333);
    const second = buildRefundLines(sold, [{ originalLineId: "a", qty: 1 }], [{ originalLineId: "a", qty: 2 }]);
    expect(first[0]!.total + second[0]!.total).toBe(-1000);
    expect(first[0]!.taxes[0]!.amount + second[0]!.taxes[0]!.amount).toBe(-153);
  });

  it("refuses over-refunds and unknown lines", () => {
    expect(() => buildRefundLines(sold, [], [{ originalLineId: "b", qty: 2 }])).toThrow(/only 1 left/);
    expect(() => buildRefundLines(sold, [{ originalLineId: "b", qty: 1 }], [{ originalLineId: "b", qty: 1 }])).toThrow();
    expect(() => buildRefundLines(sold, [], [{ originalLineId: "zz", qty: 1 }])).toThrow();
    expect(() => buildRefundLines(sold, [], [{ originalLineId: "a", qty: 0 }])).toThrow();
  });

  it("splits refund across tenders", () => {
    expect(refundTenders(-1500, [{ tender: "card", amount: 1000 }, { tender: "cash", amount: 500 }])).toEqual([
      { tender: "card", amount: -1000 },
      { tender: "cash", amount: -500 },
    ]);
    expect(() => refundTenders(-2000, [{ tender: "cash", amount: 500 }])).toThrow();
  });

  it("property: a refund never exceeds the sale, any sequence of partial refunds", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        fc.integer({ min: 0, max: 1e7 }),
        fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 20 }),
        (qty, total, steps) => {
          const line: SoldLine = { id: "x", qty, total, net: total, discount: 0, taxes: [] };
          const prev: { originalLineId: string; qty: number }[] = [];
          let refunded = 0;
          for (const s of steps) {
            const left = qty - prev.reduce((a, p) => a + p.qty, 0);
            if (left === 0) break;
            const take = Math.min(s, left);
            const [r] = buildRefundLines([line], prev, [{ originalLineId: "x", qty: take }]);
            refunded += -r!.total;
            prev.push({ originalLineId: "x", qty: take });
            expect(refunded).toBeLessThanOrEqual(total);
          }
          if (prev.reduce((a, p) => a + p.qty, 0) === qty) expect(refunded).toBe(total);
        },
      ),
    );
  });
});
