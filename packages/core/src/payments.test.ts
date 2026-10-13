import { describe, expect, it } from "vitest";
import { quickCashOptions, settleTenders } from "./payments";

describe("tenders", () => {
  it("gives change from cash", () => {
    const s = settleTenders(1250, [{ tender: "cash", amount: 2000 }]);
    expect(s).toMatchObject({ paid: 2000, remaining: 0, change: 750, complete: true });
    expect(s.settled).toEqual([{ tender: "cash", amount: 1250 }]);
  });

  it("splits card and cash", () => {
    const s = settleTenders(5000, [
      { tender: "card", amount: 3000, reference: "1234" },
      { tender: "cash", amount: 1000 },
    ]);
    expect(s).toMatchObject({ remaining: 1000, change: 0, complete: false });
  });

  it("rejects card overpayment and wrong signs", () => {
    expect(() => settleTenders(1000, [{ tender: "card", amount: 2000 }])).toThrow();
    expect(() => settleTenders(1000, [{ tender: "cash", amount: -10 }])).toThrow();
  });

  it("settles refunds without change", () => {
    const s = settleTenders(-1000, [{ tender: "cash", amount: -1000 }]);
    expect(s).toMatchObject({ paid: -1000, remaining: 0, change: 0, complete: true });
    expect(() => settleTenders(-1000, [{ tender: "cash", amount: -2000 }])).toThrow();
  });

  it("drops cash fully consumed by change", () => {
    const s = settleTenders(1000, [
      { tender: "card", amount: 1000 },
      { tender: "cash", amount: 500 },
    ]);
    expect(s.change).toBe(500);
    expect(s.settled).toEqual([{ tender: "card", amount: 1000 }]);
  });

  it("suggests quick cash amounts", () => {
    expect(quickCashOptions(1250)).toEqual([1250, 1300, 1500, 2000]);
    expect(quickCashOptions(0)).toEqual([]);
  });
});
