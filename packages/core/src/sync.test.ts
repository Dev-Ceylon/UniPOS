import { describe, expect, it } from "vitest";
import { computeCart } from "./cart";
import { backoffMs, chunk, SalePayloadSchema, SyncBatchSchema, verifySalePayload, cartInputFromPayload, type SalePayload } from "./sync";
import { uuidv7 } from "./uuid";

function payload(overrides: Partial<SalePayload> = {}): SalePayload {
  const lines = [
    {
      id: uuidv7(),
      variantId: "v1",
      name: "Tea",
      qty: 2,
      unitPrice: 1180,
      modifiers: [],
      taxRules: [{ id: "vat", name: "VAT", rateBp: 1800, inclusive: true, compound: false }],
    },
  ];
  const totals = computeCart(cartInputFromPayload({ lines, orderDiscount: null }));
  return SalePayloadSchema.parse({
    clientId: uuidv7(),
    number: "D1-0001",
    locationId: "loc",
    memberId: "mem",
    createdAt: new Date().toISOString(),
    lines,
    payments: [{ id: uuidv7(), tender: "cash", amount: 3000 }],
    change: 3000 - totals.total,
    expected: { total: totals.total, taxTotal: totals.taxTotal },
    ...overrides,
  });
}

describe("sync contract", () => {
  it("accepts a valid sale and verifies totals", () => {
    const p = payload();
    const { totals, errors } = verifySalePayload(p);
    expect(errors).toEqual([]);
    expect(totals.total).toBe(2360);
    expect(totals.taxTotal).toBe(360);
  });

  it("detects tampered totals and payments", () => {
    const p = payload();
    expect(verifySalePayload({ ...p, expected: { total: 1, taxTotal: 1 } }).errors).toHaveLength(2);
    expect(verifySalePayload({ ...p, payments: [{ ...p.payments[0]!, tender: "card" }] }).errors.join()).toMatch(/Change/);
  });

  it("validates batches", () => {
    const p = payload();
    expect(SyncBatchSchema.safeParse({ deviceId: "d", ops: [{ opId: uuidv7(), type: "sale.create", payload: p }] }).success).toBe(true);
    expect(SyncBatchSchema.safeParse({ deviceId: "d", ops: [] }).success).toBe(false);
    expect(SalePayloadSchema.safeParse({ ...p, lines: [{ ...p.lines[0]!, qty: 0 }] }).success).toBe(false);
    expect(SalePayloadSchema.safeParse({ ...p, lines: [{ ...p.lines[0]!, unitPrice: 1.5 }] }).success).toBe(false);
  });

  it("backs off and chunks", () => {
    expect(backoffMs(0, () => 0)).toBe(500);
    expect(backoffMs(3, () => 1)).toBe(8000);
    expect(backoffMs(100, () => 1)).toBe(60000);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
