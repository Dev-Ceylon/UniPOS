import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allocate, applyBasisPoints, assertMinor, currencyExponent, divRound, formatMoney, parseMoney, roundMinor, sumMinor, toDecimalString } from "./money";

describe("money", () => {
  it("knows currency exponents", () => {
    expect(currencyExponent("LKR")).toBe(2);
    expect(currencyExponent("jpy")).toBe(0);
    expect(currencyExponent("KWD")).toBe(3);
  });

  it("rounds half away from zero symmetrically", () => {
    expect(roundMinor(2.5)).toBe(3);
    expect(roundMinor(-2.5)).toBe(-3);
    expect(roundMinor(2.49999)).toBe(2);
    expect(roundMinor(1.005 * 100)).toBe(101);
    expect(roundMinor(-0.2)).toBe(0);
    expect(() => roundMinor(Number.NaN)).toThrow();
  });

  it("applies basis points", () => {
    expect(applyBasisPoints(1000, 1500)).toBe(150);
    expect(applyBasisPoints(333, 1800)).toBe(60);
    expect(divRound(7, 2)).toBe(4);
    expect(() => divRound(1, 0)).toThrow();
  });

  it("parses and formats amounts", () => {
    expect(parseMoney("12.5", "LKR")).toBe(1250);
    expect(parseMoney("1,250.00", "LKR")).toBe(125000);
    expect(parseMoney("-3.10", "USD")).toBe(-310);
    expect(parseMoney("0.005", "USD")).toBe(1);
    expect(parseMoney("0.004", "USD")).toBe(0);
    expect(parseMoney("100", "JPY")).toBe(100);
    expect(parseMoney(12.34, "USD")).toBe(1234);
    expect(() => parseMoney("abc", "USD")).toThrow();
    expect(() => parseMoney("", "USD")).toThrow();
    expect(toDecimalString(1250, "LKR")).toBe("12.50");
    expect(toDecimalString(-5, "USD")).toBe("-0.05");
    expect(toDecimalString(100, "JPY")).toBe("100");
    expect(formatMoney(125000, "USD", "en-US")).toBe("$1,250.00");
    expect(formatMoney(100, "XXX1" as string)).toContain("1.00");
    expect(sumMinor([1, 2, 3])).toBe(6);
  });

  it("rejects non-integer money", () => {
    expect(() => assertMinor(1.5)).toThrow();
    expect(() => toDecimalString(0.1, "USD")).toThrow();
  });

  it("round-trips decimal strings", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1e9, max: 1e9 }), (n) => {
        expect(parseMoney(toDecimalString(n, "USD"), "USD")).toBe(n);
      }),
    );
  });

  it("allocates exactly the total", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(allocate(5, [0, 0])).toEqual([5, 0]);
    expect(allocate(5, [])).toEqual([]);
    fc.assert(
      fc.property(fc.integer({ min: -1e7, max: 1e7 }), fc.array(fc.integer({ min: 0, max: 1e6 }), { minLength: 1, maxLength: 20 }), (total, weights) => {
        const parts = allocate(total, weights);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every(Number.isInteger)).toBe(true);
      }),
    );
  });
});
