import { describe, expect, it } from "vitest";
import { changeBp, inventoryValuation, salesByCategory, salesByDay, salesByHour, salesByProduct, salesByStaff, salesByTender, summarizeSales, taxReport, type ReportSale } from "./reports";

const vat = (amount: number) => [{ ruleId: "vat", name: "VAT", rateBp: 1800, inclusive: true, amount }];

/**
 * Hand-computed fixture (all amounts in cents):
 *  S1  2 × Tea @ 11.80 incl. VAT 18%  → gross 2360, net 2000, tax 360, cost 2×500
 *      1 × Cake @ 5.00 no tax, 1.00 discount → gross 500, disc 100, net 400, cost 200
 *      total 2760; paid cash 2760
 *  S2  1 × Tea → total 1180 (net 1000, tax 180), paid card
 *  R1  refund 1 × Tea from S1 → total −1180 (net −1000, tax −180), cash
 *  V1  voided sale 9999 → excluded
 */
const sales: ReportSale[] = [
  {
    id: "s1", createdAt: "2027-01-10T03:15:00Z", status: "completed", memberName: "Nimal", isRefund: false, total: 2760,
    lines: [
      { variantId: "tea", productName: "Tea", categoryName: "Drinks", qty: 2, gross: 2360, discount: 0, net: 2000, taxTotal: 360, total: 2360, unitCost: 500, taxes: vat(360) },
      { variantId: "cake", productName: "Cake", categoryName: "Bakery", qty: 1, gross: 500, discount: 100, net: 400, taxTotal: 0, total: 400, unitCost: 200, taxes: [] },
    ],
    payments: [{ tender: "cash", amount: 2760 }],
  },
  {
    id: "s2", createdAt: "2027-01-10T20:00:00Z", status: "completed", memberName: "Kamala", isRefund: false, total: 1180,
    lines: [{ variantId: "tea", productName: "Tea", categoryName: "Drinks", qty: 1, gross: 1180, discount: 0, net: 1000, taxTotal: 180, total: 1180, unitCost: 500, taxes: vat(180) }],
    payments: [{ tender: "card", amount: 1180 }],
  },
  {
    id: "r1", createdAt: "2027-01-11T04:00:00Z", status: "completed", memberName: "Nimal", isRefund: true, total: -1180,
    lines: [{ variantId: "tea", productName: "Tea", categoryName: "Drinks", qty: -1, gross: -1180, discount: 0, net: -1000, taxTotal: -180, total: -1180, unitCost: 500, taxes: vat(-180) }],
    payments: [{ tender: "cash", amount: -1180 }],
  },
  {
    id: "v1", createdAt: "2027-01-11T05:00:00Z", status: "voided", memberName: "Nimal", isRefund: false, total: 9999,
    lines: [{ variantId: "tea", productName: "Tea", qty: 9, gross: 9999, discount: 0, net: 9999, taxTotal: 0, total: 9999, unitCost: 1, taxes: [] }],
    payments: [{ tender: "cash", amount: 9999 }],
  },
];

describe("reports match the hand-computed fixture to the cent", () => {
  it("summary", () => {
    expect(summarizeSales(sales)).toEqual({
      saleCount: 2,
      refundCount: 1,
      itemsSold: 3,
      gross: 2860,
      discounts: 100,
      net: 2400,
      tax: 360,
      total: 2760,
      refunds: -1180,
      cost: 1200,
      profit: 1200,
      marginBp: 5000,
      averageSale: 1970,
    });
  });

  it("breakdowns", () => {
    expect(salesByTender(sales)).toEqual([
      { tender: "cash", amount: 1580 },
      { tender: "card", amount: 1180 },
    ]);
    expect(salesByStaff(sales)).toEqual([
      { member: "Nimal", count: 1, total: 1580, refunds: -1180 },
      { member: "Kamala", count: 1, total: 1180, refunds: 0 },
    ]);
    expect(salesByProduct(sales)).toEqual([
      { variantId: "tea", name: "Tea", category: "Drinks", qty: 2, net: 2000, total: 2360, cost: 1000, profit: 1000 },
      { variantId: "cake", name: "Cake", category: "Bakery", qty: 1, net: 400, total: 400, cost: 200, profit: 200 },
    ]);
    expect(salesByCategory(sales).map((c) => [c.category, c.total])).toEqual([["Drinks", 2360], ["Bakery", 400]]);
    expect(taxReport(sales)).toEqual([{ ruleId: "vat", name: "VAT", rateBp: 1800, inclusive: true, taxable: 2000, tax: 360 }]);
  });

  it("groups by day and hour in the shop's time zone", () => {
    expect(salesByDay(sales, "Asia/Colombo")).toEqual([
      { day: "2027-01-10", total: 2760, count: 1 },
      { day: "2027-01-11", total: 0, count: 1 },
    ]);
    const hours = salesByHour(sales, "Asia/Colombo");
    expect(hours[8]!.total).toBe(2760); // 03:15Z = 08:45 +05:30
    expect(hours.reduce((a, h) => a + h.total, 0)).toBe(2760);
  });

  it("inventory valuation and period change", () => {
    expect(inventoryValuation([
      { variantId: "a", name: "A", onHand: 10, unitCost: 100, price: 250, reorderPoint: 12 },
      { variantId: "b", name: "B", onHand: -2, unitCost: 100, price: 250, reorderPoint: null },
    ])).toEqual({ skus: 2, units: 10, costValue: 1000, retailValue: 2500, lowStockCount: 1 });
    expect(changeBp(150, 100)).toBe(5000);
    expect(changeBp(0, 0)).toBe(0);
    expect(changeBp(5, 0)).toBeNull();
    expect(summarizeSales([]).averageSale).toBe(0);
  });
});
