import { uuidv7, type SyncOp } from "@unipos/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "../src/client";
import { applySyncBatch } from "../src/services/sync";
import { rebuildStockLevels } from "../src/services/stock";
import { addMember, createProduct, createTenant, db, salePayload, type TestTenant } from "./helpers";

let T: TestTenant;
let tea: Awaited<ReturnType<typeof createProduct>>;
let cake: Awaited<ReturnType<typeof createProduct>>;

const op = (payload: ReturnType<typeof salePayload>): SyncOp => ({ opId: uuidv7(), type: "sale.create", payload });
const level = (variantId: string) =>
  withTenant(T.tenantId, (tx) => tx.stockLevel.findUnique({ where: { variantId_locationId: { variantId, locationId: T.locationId } } }), { client: db }).then((l) => l?.onHand ?? 0);

beforeAll(async () => {
  T = await createTenant("Sync Shop");
  tea = await createProduct(T, "Tea", 1180, { stock: 100, cost: 500 });
  cake = await createProduct(T, "Cake", 500, { stock: 1 });
});
afterAll(() => db.$disconnect());

describe("sync endpoint logic", () => {
  it("applies a sale, deducts stock and is idempotent on replay", async () => {
    const o = op(salePayload(T, [{ variantId: tea.variant.id, price: 1180, qty: 2, rules: tea.rules }], { extraCash: 640 }));
    const [r1] = await applySyncBatch(T.ctx, "dev-1", [o], db);
    expect(r1).toMatchObject({ status: "applied", serverId: o.payload.clientId, flags: [] });
    expect(await level(tea.variant.id)).toBe(98);
    const sale = await withTenant(T.tenantId, (tx) => tx.sale.findUnique({ where: { id: o.payload.clientId }, include: { payments: true, lines: true } }), { client: db });
    expect(sale!.total).toBe(2360);
    expect(sale!.change).toBe(640);
    expect(sale!.payments[0]!.amount).toBe(2360); // change taken off cash
    expect(sale!.lines[0]!.unitCost).toBe(500);
    // same op again → duplicate, no double deduction
    const [r2] = await applySyncBatch(T.ctx, "dev-1", [o], db);
    expect(r2!.status).toBe("duplicate");
    // same sale under a new op id (client lost the ack) → still a duplicate
    const [r3] = await applySyncBatch(T.ctx, "dev-1", [{ ...o, opId: uuidv7() }], db);
    expect(r3!.status).toBe("duplicate");
    expect(await level(tea.variant.id)).toBe(98);
  });

  it("allows negative stock offline and flags it after sync", async () => {
    const o = op(salePayload(T, [{ variantId: cake.variant.id, price: 500, qty: 3, rules: cake.rules }]));
    const [r] = await applySyncBatch(T.ctx, "dev-1", [o], db);
    expect(r!.status).toBe("applied");
    expect(r!.flags?.some((f) => f.startsWith("negative_stock"))).toBe(true);
    expect(await level(cake.variant.id)).toBe(-2);
  });

  it("rejects tampered totals and unknown variants without blocking the batch", async () => {
    const bad = salePayload(T, [{ variantId: tea.variant.id, price: 1180, qty: 1, rules: tea.rules }]);
    bad.expected.total = 1;
    const unknown = salePayload(T, [{ variantId: "nope", price: 100, qty: 1, rules: [] }]);
    const good = salePayload(T, [{ variantId: tea.variant.id, price: 1180, qty: 1, rules: tea.rules }]);
    const res = await applySyncBatch(T.ctx, "dev-1", [op(bad), op(unknown), op(good), { opId: "junk" } as unknown as SyncOp], db);
    expect(res.map((r) => r.status)).toEqual(["rejected", "rejected", "applied", "rejected"]);
    expect(res[0]!.error).toMatch(/mismatch/);
  });

  it("flags price overrides and discounts by a cashier without permission", async () => {
    const cashier = await addMember(T, "cashier");
    const p = salePayload(T, [{ variantId: tea.variant.id, price: 100, qty: 1, rules: tea.rules }], { memberId: cashier.member.id });
    p.lines[0]!.catalogPrice = 1180;
    const [r] = await applySyncBatch(cashier, "dev-2", [op(p)], db);
    expect(r!.status).toBe("applied");
    expect(r!.flags!.some((f) => f.startsWith("price_override_unauthorized"))).toBe(true);
  });

  it("rejects a cashier id from another tenant", async () => {
    const other = await createTenant("Other");
    const p = salePayload(T, [{ variantId: tea.variant.id, price: 1180, qty: 1, rules: tea.rules }], { memberId: other.ownerMemberId });
    const [r] = await applySyncBatch(T.ctx, "dev-1", [op(p)], db);
    expect(r).toMatchObject({ status: "rejected", error: "Unknown cashier" });
  });

  it("8-hour offline day: 500 sales, 3 forced retries, concurrent replays → nothing lost, no duplicates", async () => {
    const before = await level(tea.variant.id);
    const salesBefore = await withTenant(T.tenantId, (tx) => tx.sale.count(), { client: db });
    const start = Date.now() - 8 * 3600_000;
    const ops: SyncOp[] = Array.from({ length: 500 }, (_, i) => {
      const p = salePayload(T, [{ variantId: tea.variant.id, price: 1180, qty: 1 + (i % 3), rules: tea.rules }], { tender: i % 2 ? "card" : "cash" });
      p.createdAt = new Date(start + i * 57_600).toISOString();
      return op(p);
    });
    const expectedQty = ops.reduce((a, o) => a + (o.type === "sale.create" ? o.payload.lines[0]!.qty : 0), 0);
    const expectedTotal = ops.reduce((a, o) => a + (o.type === "sale.create" ? o.payload.expected.total : 0), 0);

    // Attempt 1: connection "drops" after the first 180 ops reach the server.
    const first = await applySyncBatch(T.ctx, "dev-off", ops.slice(0, 180), db);
    expect(first.every((r) => r.status === "applied")).toBe(true);
    // Attempt 2: client didn't get the acks, resends everything in batches of 50 → partial again.
    for (let i = 0; i < 300; i += 50) await applySyncBatch(T.ctx, "dev-off", ops.slice(i, i + 50), db);
    // Attempt 3: two tabs retry the full outbox concurrently.
    const batches = Array.from({ length: 10 }, (_, i) => ops.slice(i * 50, i * 50 + 50));
    const concurrent = await Promise.all([
      Promise.all(batches.map((b) => applySyncBatch(T.ctx, "dev-off", b, db))),
      Promise.all(batches.map((b) => applySyncBatch(T.ctx, "dev-off", b, db))),
    ]);
    const statuses = concurrent.flat(2).map((r) => r.status);
    expect(statuses.every((s) => s === "applied" || s === "duplicate")).toBe(true);
    // Attempt 4 (final forced retry): all duplicates.
    const final = (await Promise.all(batches.map((b) => applySyncBatch(T.ctx, "dev-off", b, db)))).flat();
    expect(final.every((r) => r.status === "duplicate")).toBe(true);

    const ids = ops.map((o) => (o.type === "sale.create" ? o.payload.clientId : ""));
    const stored = await withTenant(T.tenantId, (tx) => tx.sale.findMany({ where: { id: { in: ids } }, select: { id: true, total: true } }), { client: db });
    expect(stored).toHaveLength(500);
    expect(stored.reduce((a, s) => a + s.total, 0)).toBe(expectedTotal);
    expect(await withTenant(T.tenantId, (tx) => tx.sale.count(), { client: db })).toBe(salesBefore + 500);
    expect(await level(tea.variant.id)).toBe(before - expectedQty);
    const movements = await withTenant(T.tenantId, (tx) => tx.stockMovement.count({ where: { refId: { in: ids } } }), { client: db });
    expect(movements).toBe(500);
    // the cached level still equals the ledger sum
    expect(await withTenant(T.tenantId, (tx) => rebuildStockLevels(tx), { client: db })).toBe(0);
  });
});
