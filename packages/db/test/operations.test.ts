import { ForbiddenError, uuidv7 } from "@unipos/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "../src/client";
import { exportBackup, restoreBackup } from "../src/services/backup";
import { exportProductsCsv, importProductsCsv, saveProduct } from "../src/services/catalog";
import { eraseCustomer, exportCustomerData, issueGiftCard, loyaltyBalance } from "../src/services/customers";
import {
  adjustStock,
  completeStocktake,
  createPurchaseOrder,
  createTransfer,
  markOrdered,
  receivePurchaseOrder,
  receiveTransfer,
  recordCounts,
  sendTransfer,
  startStocktake,
} from "../src/services/inventory";
import { createRefund, voidSale } from "../src/services/sales";
import { closeShift, openShift } from "../src/services/shifts";
import { rebuildStockLevels } from "../src/services/stock";
import { applySyncBatch } from "../src/services/sync";
import { loadReportSales } from "../src/services/reports";
import { summarizeSales } from "@unipos/core";
import { addMember, createProduct, createTenant, db, salePayload, type TestTenant } from "./helpers";

let T: TestTenant;
let tea: Awaited<ReturnType<typeof createProduct>>;
const tx = <R>(fn: Parameters<typeof withTenant<R>>[1]) => withTenant(T.tenantId, fn, { client: db, timeout: 60_000 });
const level = (variantId: string, locationId = T.locationId) =>
  tx((t) => t.stockLevel.findUnique({ where: { variantId_locationId: { variantId, locationId } } })).then((l) => l?.onHand ?? 0);
async function sell(items: Parameters<typeof salePayload>[1], opts: Parameters<typeof salePayload>[2] = {}) {
  const p = salePayload(T, items, opts);
  const [r] = await applySyncBatch(T.ctx, "dev", [{ opId: uuidv7(), type: "sale.create", payload: p }], db);
  expect(r!.status).toBe("applied");
  return p.clientId;
}

beforeAll(async () => {
  T = await createTenant("Ops Shop", { loyalty: true });
  tea = await createProduct(T, "Tea", 1180, { stock: 50, cost: 600 });
});
afterAll(() => db.$disconnect());

describe("refunds and voids", () => {
  it("refunds part of a sale, restocks, and never exceeds what was sold", async () => {
    const saleId = await sell([{ variantId: tea.variant.id, price: 1180, qty: 3, rules: tea.rules }]);
    const lineId = (await tx((t) => t.saleLine.findFirstOrThrow({ where: { saleId } }))).id;
    expect(await level(tea.variant.id)).toBe(47);
    const r1 = await tx((t) => createRefund(t, T.ctx, { originalSaleId: saleId, lines: [{ lineId, qty: 1 }], restock: true, reason: "Damaged" }));
    expect(r1.total).toBe(-1180);
    expect(r1.isRefund).toBe(true);
    expect(r1.payments[0]).toMatchObject({ tender: "cash", amount: -1180 });
    expect(await level(tea.variant.id)).toBe(48);
    const r2 = await tx((t) => createRefund(t, T.ctx, { originalSaleId: saleId, lines: [{ lineId, qty: 2 }], restock: false, reason: "Changed mind" }));
    expect(r1.total + r2.total).toBe(-3540);
    await expect(tx((t) => createRefund(t, T.ctx, { originalSaleId: saleId, lines: [{ lineId, qty: 1 }], restock: false, reason: "x" }))).rejects.toThrow(
      /only 0 left/,
    );
    const audit = await tx((t) => t.auditLog.count({ where: { action: "sale.refund", entityId: saleId } }));
    expect(audit).toBe(2);
  });

  it("requires permission to refund and void", async () => {
    const cashier = await addMember(T, "cashier");
    const saleId = await sell([{ variantId: tea.variant.id, price: 1180, qty: 1, rules: tea.rules }]);
    await expect(tx((t) => createRefund(t, cashier, { originalSaleId: saleId, lines: [], restock: true, reason: "" }))).rejects.toThrow(ForbiddenError);
    await expect(tx((t) => voidSale(t, cashier, saleId, "x"))).rejects.toThrow(ForbiddenError);
  });

  it("voids a sale and reverses stock", async () => {
    const before = await level(tea.variant.id);
    const saleId = await sell([{ variantId: tea.variant.id, price: 1180, qty: 2, rules: tea.rules }]);
    expect(await level(tea.variant.id)).toBe(before - 2);
    const v = await tx((t) => voidSale(t, T.ctx, saleId, "Wrong item"));
    expect(v.status).toBe("voided");
    expect(await level(tea.variant.id)).toBe(before);
    await expect(tx((t) => voidSale(t, T.ctx, saleId, "again"))).rejects.toThrow();
  });
});

describe("shifts", () => {
  it("cash-up computes expected cash and variance", async () => {
    const shift = await tx((t) => openShift(t, T.ctx, T.locationId, 10000));
    await expect(tx((t) => openShift(t, T.ctx, T.locationId, 0))).rejects.toThrow(/already open/);
    await sell([{ variantId: tea.variant.id, price: 1180, qty: 2, rules: tea.rules }], { shiftId: shift.id, extraCash: 140 });
    await sell([{ variantId: tea.variant.id, price: 1180, qty: 1, rules: tea.rules }], { shiftId: shift.id, tender: "card" });
    await applySyncBatch(
      T.ctx,
      "dev",
      [
        {
          opId: uuidv7(),
          type: "cash.movement",
          payload: { clientId: uuidv7(), shiftId: shift.id, type: "out", amount: 500, reason: "Milk", createdAt: new Date().toISOString() },
        },
      ],
      db,
    );
    const res = await tx((t) => closeShift(t, T.ctx, shift.id, { denominations: { "10000": 1, "2000": 1, "100": 3 } }));
    // expected = 10000 float + 2360 cash sales − 500 out = 11860; counted 12300
    expect(res.expected).toBe(11860);
    expect(res.shift.countedCash).toBe(12300);
    expect(res.variance).toBe(440);
    expect(res.byTender.find((b) => b.tender === "card")?.amount).toBe(1180);
    await expect(tx((t) => closeShift(t, T.ctx, shift.id, { amount: 1 }))).rejects.toThrow(/already closed/);
  });
});

describe("inventory", () => {
  it("adjusts, stocktakes, transfers and receives purchase orders through the ledger", async () => {
    const p = await createProduct(T, "Rice", 50000, { stock: 10, cost: 40000 });
    const v = p.variant.id;
    expect(await tx((t) => adjustStock(t, T.ctx, { variantId: v, locationId: T.locationId, mode: "delta", qty: -2, reason: "damage" }))).toBe(8);
    expect(await tx((t) => adjustStock(t, T.ctx, { variantId: v, locationId: T.locationId, mode: "set", qty: 12, reason: "adjust" }))).toBe(12);

    const st = await tx((t) => startStocktake(t, T.ctx, T.locationId));
    await tx((t) => recordCounts(t, T.ctx, st.id, [{ variantId: v, counted: 11 }]));
    const variances = await tx((t) => completeStocktake(t, T.ctx, st.id));
    expect(variances).toEqual([{ variantId: v, expected: 12, counted: 11, variance: -1 }]);
    expect(await level(v)).toBe(11);

    const branch = await tx((t) => t.location.create({ data: { name: "Branch", code: "BR" } }));
    const tr = await tx((t) => createTransfer(t, T.ctx, { fromLocationId: T.locationId, toLocationId: branch.id, lines: [{ variantId: v, qty: 5 }] }));
    await tx((t) => sendTransfer(t, T.ctx, tr.id));
    expect(await level(v)).toBe(6);
    expect(await level(v, branch.id)).toBe(0); // in transit
    const line = await tx((t) => t.transferLine.findFirstOrThrow({ where: { transferId: tr.id } }));
    await tx((t) => receiveTransfer(t, T.ctx, tr.id, { [line.id]: 4 }));
    expect(await level(v, branch.id)).toBe(4);
    expect(await level(v)).toBe(7); // 1 not received returned to source

    const supplier = await tx((t) => t.supplier.create({ data: { name: "Wholesale" } }));
    const po = await tx((t) =>
      createPurchaseOrder(t, T.ctx, { supplierId: supplier.id, locationId: T.locationId, lines: [{ variantId: v, qty: 10, unitCost: 42000 }] }),
    );
    expect(po.total).toBe(420000);
    await tx((t) => markOrdered(t, T.ctx, po.id));
    const pol = await tx((t) => t.purchaseOrderLine.findFirstOrThrow({ where: { orderId: po.id } }));
    expect(await tx((t) => receivePurchaseOrder(t, T.ctx, po.id, { [pol.id]: 6 }))).toBe(false);
    expect(await tx((t) => receivePurchaseOrder(t, T.ctx, po.id, { [pol.id]: 4 }))).toBe(true);
    await expect(tx((t) => receivePurchaseOrder(t, T.ctx, po.id, { [pol.id]: 1 }))).rejects.toThrow();
    expect(await level(v)).toBe(17);
    expect((await tx((t) => t.variant.findUniqueOrThrow({ where: { id: v } }))).cost).toBe(42000);

    // stock on hand equals the ledger sum
    expect(await tx((t) => rebuildStockLevels(t))).toBe(0);
  });
});

describe("catalog", () => {
  it("saves products with variants and rejects duplicate SKUs", async () => {
    const p = await tx((t) =>
      saveProduct(t, T.ctx, {
        name: "T-shirt",
        variants: [
          { name: "S", sku: "TS-S", price: 150000 },
          { name: "M", sku: "TS-M", price: 150000 },
        ],
      }),
    );
    expect(p.variants).toHaveLength(2);
    const updated = await tx((t) =>
      saveProduct(t, T.ctx, { name: "T-shirt", variants: [{ id: p.variants[0]!.id, name: "S", sku: "TS-S", price: 160000 }] }, p.id),
    );
    expect(updated.variants).toHaveLength(1);
    await expect(tx((t) => saveProduct(t, T.ctx, { name: "Dup", variants: [{ sku: "TS-S", price: 1 }] }))).rejects.toThrow(/already used/);
  });

  it("imports and exports CSV", async () => {
    const csv = [
      "name,variant,sku,barcode,category,price,cost,tax_class,track_stock,stock,reorder_point",
      "Imported Soap,,IMP-1,2000000000015,Household,180.00,120,Standard,yes,25,5",
      "Imported Shirt,Red,IMP-2,,Clothing,1500,900,,yes,3,",
      "Imported Shirt,Blue,IMP-3,,Clothing,1500,900,,yes,4,",
      ",,,,,,,,,,",
      "Bad Price,,IMP-4,,,abc,,,,,",
    ].join("\n");
    const res = await tx((t) => importProductsCsv(t, T.ctx, csv, T.locationId));
    expect(res.created).toBe(3);
    expect(res.errors.map((e) => e.row)).toEqual([5, 6]);
    const shirt = await tx((t) => t.product.findFirstOrThrow({ where: { name: "Imported Shirt" }, include: { variants: true } }));
    expect(shirt.variants).toHaveLength(2);
    const soap = await tx((t) => t.variant.findFirstOrThrow({ where: { sku: "IMP-1" } }));
    expect(soap.price).toBe(18000);
    expect(await level(soap.id)).toBe(25);
    // re-import updates by SKU
    const res2 = await tx((t) => importProductsCsv(t, T.ctx, "name,sku,price,stock\nImported Soap,IMP-1,200,30\n", T.locationId));
    expect(res2.updated).toBe(1);
    expect(await level(soap.id)).toBe(30);
    const out = await tx((t) => exportProductsCsv(t, T.ctx));
    expect(out).toContain("IMP-1");
    expect(out.split("\r\n")[0]).toContain("name,variant,sku");
  });
});

describe("customers, loyalty, gift cards", () => {
  it("earns points, redeems gift cards, exports and erases personal data", async () => {
    const customer = await tx((t) => t.customer.create({ data: { name: "Ashen", phone: "0771234567", email: "a@example.com" } }));
    await sell([{ variantId: tea.variant.id, price: 1180, qty: 20, rules: tea.rules }], { customerId: customer.id });
    expect(await tx((t) => loyaltyBalance(t, customer.id))).toBe(2); // 23,600 cents / 10,000 per point
    const card = await tx((t) => issueGiftCard(t, T.ctx, { value: 5000, customerId: customer.id }));
    await sell([{ variantId: tea.variant.id, price: 1180, qty: 1, rules: tea.rules }], { tender: "gift_card", reference: card.code });
    expect((await tx((t) => t.giftCard.findUniqueOrThrow({ where: { id: card.id } }))).balance).toBe(3820);

    const data = await tx((t) => exportCustomerData(t, T.ctx, customer.id));
    expect(data.customer.email).toBe("a@example.com");
    expect(data.sales.length).toBeGreaterThan(0);
    await tx((t) => eraseCustomer(t, T.ctx, customer.id));
    const erased = await tx((t) => t.customer.findUniqueOrThrow({ where: { id: customer.id } }));
    expect(erased).toMatchObject({ name: "Erased customer", phone: null, email: null });
    expect(await tx((t) => t.sale.count({ where: { customerId: customer.id } }))).toBe(0);
  });
});

describe("reports and backup", () => {
  it("report totals equal the stored sales", async () => {
    const sales = await tx((t) => loadReportSales(t, { from: new Date(Date.now() - 86400_000), to: new Date(Date.now() + 60_000) }));
    const s = summarizeSales(sales);
    const agg = await tx((t) => t.sale.aggregate({ where: { status: "completed" }, _sum: { total: true } }));
    expect(s.total).toBe(agg._sum.total);
  });

  it("exports a backup and restores it exactly", async () => {
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: T.tenantId } });
    const backup = await tx((t) => exportBackup(t, T.ctx, { ...tenant, settings: tenant.settings, theme: tenant.theme }));
    const counts = Object.fromEntries(Object.entries(backup.tables).map(([k, v]) => [k, v.length]));
    expect(counts.Sale).toBeGreaterThan(0);
    // wreck some data, then restore
    await tx((t) => t.product.updateMany({ data: { name: "broken" } }));
    const json = JSON.parse(JSON.stringify(backup));
    await tx((t) => restoreBackup(t, T.ctx, json));
    const after = await tx((t) => exportBackup(t, T.ctx, { ...tenant, settings: tenant.settings, theme: tenant.theme }));
    for (const [k, n] of Object.entries(counts)) {
      if (k === "AuditLog") continue;
      expect([k, after.tables[k]!.length]).toEqual([k, n]);
    }
    expect(await tx((t) => t.product.count({ where: { name: "broken" } }))).toBe(0);
    expect(await tx((t) => rebuildStockLevels(t))).toBe(0);
    await expect(tx((t) => restoreBackup(t, T.ctx, { format: "nope" } as never))).rejects.toThrow();
  });
});
