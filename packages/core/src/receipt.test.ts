import { describe, expect, it } from "vitest";
import { buildReceipt, DEFAULT_RECEIPT_TEMPLATE, receiptToText } from "./receipt";

describe("receipt", () => {
  const sale = {
    number: "MAIN-0001",
    createdAt: "2027-01-10T03:15:00Z",
    businessName: "Kade",
    locationName: "Main St",
    locationAddress: "1 Main St\nColombo",
    cashier: "Nimal",
    customer: "Ashen",
    table: "T4",
    lines: [{ name: "Tea", qty: 2, unitPrice: 1180, total: 2360, discount: 100, modifiers: [{ name: "Milk", priceDelta: 50 }] }],
    subtotal: 2460,
    discountTotal: 100,
    taxes: [{ ruleId: "vat", name: "VAT", rateBp: 1800, inclusive: true, amount: 360 }],
    taxTotal: 360,
    total: 2360,
    payments: [{ tender: "cash", amount: 3000 }],
    change: 640,
    currency: "LKR",
    timeZone: "Asia/Colombo",
  };

  it("builds a model honouring the template", () => {
    const r = buildReceipt(sale, { ...DEFAULT_RECEIPT_TEMPLATE, showTable: true, header: "VAT reg 123" });
    expect(r.title).toBe("Kade");
    expect(r.headerLines).toEqual(["Main St", "1 Main St", "Colombo", "VAT reg 123"]);
    expect(r.meta.map((m) => m.label)).toEqual(["Receipt", "Date", "Cashier", "Customer", "Table"]);
    expect(r.totals.find((t) => t.strong)?.value).toContain("23.60");
    expect(r.totals.some((t) => t.label === "VAT 18% (incl.)")).toBe(true);
    expect(r.payments.at(-1)?.label).toBe("Change");
    expect(r.items[0]!.sub).toHaveLength(2);
    const text = receiptToText(r);
    expect(text).toContain("Kade");
    expect(text).toContain("Thank you!");
  });

  it("hides optional parts", () => {
    const r = buildReceipt({ ...sale, isRefund: true, change: 0 }, { ...DEFAULT_RECEIPT_TEMPLATE, showTaxBreakdown: false, showCashier: false, showBarcode: false, footer: "", logoText: "KADE" });
    expect(r.title).toBe("KADE");
    expect(r.meta[0]!.label).toBe("Refund");
    expect(r.totals.some((t) => t.label === "Tax")).toBe(true);
    expect(r.barcode).toBeUndefined();
    expect(r.footerLines).toEqual([]);
    expect(receiptToText(r, 20)).toContain("\n");
  });
});
