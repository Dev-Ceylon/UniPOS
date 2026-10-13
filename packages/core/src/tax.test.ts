import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { calculateLineTax, rulesForRegion, summarizeTaxes, validateRules, type TaxRule } from "./tax";

const vatEx: TaxRule = { id: "vat", name: "VAT", rateBp: 1800, inclusive: false, compound: false };
const vatIn: TaxRule = { ...vatEx, inclusive: true };
const ssclIn: TaxRule = { id: "sscl", name: "SSCL", rateBp: 250, inclusive: true, compound: false, priority: -1 };

describe("tax engine", () => {
  it("adds exclusive tax", () => {
    const r = calculateLineTax(10000, [vatEx]);
    expect(r).toMatchObject({ net: 10000, exclusiveTax: 1800, inclusiveTax: 0, total: 11800 });
  });

  it("extracts inclusive tax", () => {
    const r = calculateLineTax(11800, [vatIn]);
    expect(r).toMatchObject({ net: 10000, inclusiveTax: 1800, exclusiveTax: 0, total: 11800 });
  });

  it("handles compound taxes (tax on tax)", () => {
    const state: TaxRule = { id: "s", name: "State", rateBp: 1000, inclusive: false, compound: false, priority: 0 };
    const city: TaxRule = { id: "c", name: "City", rateBp: 500, inclusive: false, compound: true, priority: 1 };
    const r = calculateLineTax(10000, [city, state]);
    expect(r.taxes.map((t) => t.amount)).toEqual([1000, 550]);
    expect(r.total).toBe(11550);
  });

  it("handles inclusive compound stacks exactly", () => {
    const a: TaxRule = { id: "a", name: "A", rateBp: 1000, inclusive: true, compound: false, priority: 0 };
    const b: TaxRule = { id: "b", name: "B", rateBp: 500, inclusive: true, compound: true, priority: 1 };
    const r = calculateLineTax(11550, [a, b]);
    expect(r.net).toBe(10000);
    expect(r.taxes.map((t) => t.amount)).toEqual([1000, 550]);
  });

  it("mixes inclusive and exclusive rules", () => {
    const r = calculateLineTax(10250, [ssclIn, vatEx]);
    expect(r.net).toBe(10000);
    expect(r.inclusiveTax).toBe(250);
    expect(r.exclusiveTax).toBe(1800);
    expect(r.total).toBe(12050);
  });

  it("mirrors negative amounts for refunds", () => {
    const pos = calculateLineTax(999, [vatIn]);
    const neg = calculateLineTax(-999, [vatIn]);
    expect(neg.net).toBe(-pos.net);
    expect(neg.taxes[0]!.amount).toBe(-pos.taxes[0]!.amount);
    expect(calculateLineTax(0, [vatEx]).total).toBe(0);
  });

  it("no rules means no tax", () => {
    expect(calculateLineTax(500, [])).toMatchObject({ net: 500, total: 500, taxes: [] });
  });

  it("validates rates", () => {
    expect(() => validateRules([{ ...vatEx, rateBp: -1 }])).toThrow();
    expect(() => validateRules([{ ...vatEx, rateBp: 1.5 }])).toThrow();
  });

  it("summarizes and filters by region", () => {
    const s = summarizeTaxes([calculateLineTax(1000, [vatEx]).taxes, calculateLineTax(2000, [vatEx]).taxes]);
    expect(s).toHaveLength(1);
    expect(s[0]!.amount).toBe(540);
    const rules = [
      { ...vatEx, region: null },
      { ...vatEx, id: "wp", region: "WP" },
      { ...vatEx, id: "cp", region: "CP" },
    ];
    expect(rulesForRegion(rules, "WP").map((r) => r.id)).toEqual(["vat", "wp"]);
    expect(rulesForRegion(rules, null)).toHaveLength(3);
  });

  const ruleArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 4 }),
    name: fc.constant("T"),
    rateBp: fc.integer({ min: 0, max: 3000 }),
    inclusive: fc.boolean(),
    compound: fc.boolean(),
    priority: fc.integer({ min: 0, max: 3 }),
  });

  it("inclusive prices round-trip: net + inclusive taxes == price", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e8, max: 1e8 }), fc.array(ruleArb.map((r) => ({ ...r, inclusive: true })), { maxLength: 4 }), (amount, rules) => {
        const r = calculateLineTax(amount, rules);
        expect(r.net + r.inclusiveTax).toBe(amount);
        expect(r.total).toBe(amount);
      }),
    );
  });

  it("exclusive total == amount + exclusive taxes and all values are integers", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e8 }), fc.array(ruleArb, { maxLength: 4 }), (amount, rules) => {
        const r = calculateLineTax(amount, rules);
        expect(r.total).toBe(amount + r.exclusiveTax);
        expect(r.taxes.every((t) => Number.isInteger(t.amount))).toBe(true);
        expect(r.taxes.reduce((a, t) => a + t.amount, 0)).toBe(r.inclusiveTax + r.exclusiveTax);
      }),
    );
  });
});
