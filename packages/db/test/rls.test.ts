import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withTenant } from "../src/client";
import { createProduct, createTenant, db, type TestTenant } from "./helpers";

let A: TestTenant;
let B: TestTenant;
let bProductId: string;

beforeAll(async () => {
  A = await createTenant("Alpha");
  B = await createTenant("Beta");
  await createProduct(A, "Alpha Tea", 1000, { stock: 5 });
  bProductId = (await createProduct(B, "Beta Secret", 2000, { stock: 7 })).product.id;
});
afterAll(() => db.$disconnect());

describe("tenant isolation (RLS)", () => {
  it("every tenant table has RLS enabled, forced and a policy", async () => {
    const owner = new pg.Client({ connectionString: process.env.TEST_OWNER_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/unipos_test" });
    await owner.connect();
    const { rows } = await owner.query(`
      SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
             (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
      FROM pg_class c JOIN information_schema.columns col ON col.table_name = c.relname AND col.column_name = 'tenantId'
      WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace`);
    await owner.end();
    const exempt = new Set(["member", "invitation"]); // auth tables, guarded in the app
    const tenantTables = rows.filter((r) => !exempt.has(r.relname));
    expect(tenantTables.length).toBeGreaterThanOrEqual(30);
    for (const r of tenantTables) {
      expect({ table: r.relname, rls: r.relrowsecurity, forced: r.relforcerowsecurity, policy: Number(r.policies) > 0 }).toEqual({
        table: r.relname,
        rls: true,
        forced: true,
        policy: true,
      });
    }
  });

  it("the app role cannot bypass RLS", async () => {
    const rows = await db.$queryRaw<{ rolbypassrls: boolean; rolsuper: boolean }[]>`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`;
    expect(rows[0]).toEqual({ rolbypassrls: false, rolsuper: false });
  });

  it("tenant A cannot read tenant B's rows, even with a forged query", async () => {
    await withTenant(
      A.tenantId,
      async (tx) => {
        // forged where clause asking for B's data explicitly
        expect(await tx.product.findMany({ where: { tenantId: B.tenantId } })).toEqual([]);
        expect(await tx.product.findUnique({ where: { id: bProductId } })).toBeNull();
        // raw SQL without any tenant filter
        const raw = await tx.$queryRawUnsafe<{ name: string }[]>(`SELECT name FROM "Product"`);
        expect(raw.map((r) => r.name)).toEqual(["Alpha Tea"]);
        const levels = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT count(*) AS n FROM "StockLevel" WHERE "tenantId" = '${B.tenantId}'`);
        expect(Number(levels[0]!.n)).toBe(0);
      },
      { client: db },
    );
  });

  it("tenant A cannot write into or modify tenant B", async () => {
    await expect(
      withTenant(A.tenantId, (tx) => tx.product.create({ data: { name: "Injected", tenantId: B.tenantId } }), { client: db }),
    ).rejects.toThrow();
    const updated = await withTenant(A.tenantId, (tx) => tx.product.updateMany({ where: { id: bProductId }, data: { name: "pwned" } }), { client: db });
    expect(updated.count).toBe(0);
    const deleted = await withTenant(A.tenantId, (tx) => tx.$executeRawUnsafe(`DELETE FROM "Product" WHERE id = '${bProductId}'`), { client: db });
    expect(deleted).toBe(0);
    const still = await withTenant(B.tenantId, (tx) => tx.product.findUnique({ where: { id: bProductId } }), { client: db });
    expect(still?.name).toBe("Beta Secret");
  });

  it("without a tenant set, no business rows are visible", async () => {
    expect(await db.product.count()).toBe(0);
    expect(await db.sale.count()).toBe(0);
    await expect(db.product.create({ data: { name: "Orphan" } })).rejects.toThrow();
  });

  it("the tenant setting does not leak across transactions on a pooled connection", async () => {
    await withTenant(A.tenantId, (tx) => tx.product.count(), { client: db });
    expect(await db.product.count()).toBe(0);
  });

  it("the stock ledger is append-only", async () => {
    await expect(
      withTenant(A.tenantId, (tx) => tx.stockMovement.updateMany({ data: { qtyChange: 999 } }), { client: db }),
    ).rejects.toThrow(/append-only/);
  });
});
