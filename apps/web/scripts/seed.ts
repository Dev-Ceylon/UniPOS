/**
 * Demo seed: one retail shop and one restaurant, an owner and a cashier, and
 * two weeks of sales so the dashboard and reports have data.
 *
 *   pnpm --filter @unipos/web seed            (idempotent: skips if the demo owner exists)
 *   SEED_RESET=1 pnpm --filter @unipos/web seed  (deletes the demo tenants first)
 *
 * Logins: owner@demo.unipos.app / demo1234 (PIN 1111), cashier@demo.unipos.app / demo1234 (PIN 2222)
 */
import "dotenv/config";
import { computeCart, uuidv7, type SyncOp, type TaxRule } from "@unipos/core";
import { applySyncBatch, bootstrapTenant, createPrismaClient, loadMemberContext, openShift, withTenant } from "@unipos/db";
import { hashPassword } from "better-auth/crypto";
import { hashPin } from "../src/lib/pin-hash";

const prisma = createPrismaClient(process.env.DATABASE_URL);
const PASSWORD = "demo1234";

async function user(email: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing.id;
  const id = uuidv7();
  await prisma.user.create({ data: { id, email, name, emailVerified: true } });
  await prisma.account.create({ data: { id: uuidv7(), userId: id, accountId: id, providerId: "credential", password: await hashPassword(PASSWORD) } });
  return id;
}

async function tenant(name: string, slug: string, ownerUserId: string, type: "retail" | "restaurant") {
  const tenantId = uuidv7();
  const memberId = uuidv7();
  await prisma.tenant.create({ data: { id: tenantId, name, slug } });
  await prisma.member.create({ data: { id: memberId, tenantId, userId: ownerUserId, role: "owner" } });
  const res = await bootstrapTenant(
    {
      tenantId,
      ownerMemberId: memberId,
      ownerName: "Ashen (Owner)",
      businessType: type,
      currency: "LKR",
      locale: "en",
      timezone: "Asia/Colombo",
      locationName: type === "retail" ? "Colombo 03" : "Galle Fort",
      taxName: "VAT",
      taxRateBp: 1800,
      taxInclusive: true,
      pinHash: await hashPin("1111"),
      seedDemo: true,
    },
    prisma,
  );
  return { tenantId, memberId, ...res };
}

async function history(tenantId: string, memberId: string, locationId: string, days = 14) {
  const ctx = await loadMemberContext(memberId, tenantId, prisma);
  if (!ctx) throw new Error("no ctx");
  const products = await withTenant(tenantId, (tx) => tx.variant.findMany({ include: { product: { include: { taxClass: { include: { rules: true } } } } } }), { client: prisma });
  const customers = await withTenant(tenantId, (tx) => tx.customer.findMany(), { client: prisma });
  let seed = 42;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ops: SyncOp[] = [];
  for (let d = days; d >= 1; d--) {
    const count = 8 + Math.floor(rnd() * 10);
    for (let i = 0; i < count; i++) {
      const at = new Date(Date.now() - d * 86400_000);
      at.setUTCHours(3 + Math.floor(rnd() * 12), Math.floor(rnd() * 60));
      const n = 1 + Math.floor(rnd() * 4);
      const lines = Array.from({ length: n }, () => {
        const v = products[Math.floor(rnd() * products.length)]!;
        const rules: TaxRule[] = (v.product.taxClass?.rules ?? []).map((r) => ({ id: r.id, name: r.name, rateBp: r.rateBp, inclusive: r.inclusive, compound: r.compound }));
        return { id: uuidv7(), variantId: v.id, name: v.product.name, qty: 1 + Math.floor(rnd() * 2), unitPrice: v.price, catalogPrice: v.price, unitCost: v.cost, modifiers: [], taxRules: rules };
      });
      const totals = computeCart({ lines: lines.map((l) => ({ ...l, discount: null })) });
      const cash = rnd() < 0.6;
      const tendered = cash ? Math.ceil(totals.total / 50000) * 50000 : totals.total;
      ops.push({
        opId: uuidv7(),
        type: "sale.create",
        payload: {
          clientId: uuidv7(),
          number: `SEED-${String(ops.length + 1).padStart(5, "0")}`,
          locationId,
          memberId,
          customerId: customers.length && rnd() < 0.3 ? customers[0]!.id : null,
          createdAt: at.toISOString(),
          lines,
          payments: [{ id: uuidv7(), tender: cash ? "cash" : "card", amount: tendered, reference: cash ? null : "****4242" }],
          change: tendered - totals.total,
          expected: { total: totals.total, taxTotal: totals.taxTotal },
        },
      });
    }
  }
  for (let i = 0; i < ops.length; i += 50) await applySyncBatch(ctx, "seed", ops.slice(i, i + 50), prisma);
  return ops.length;
}

async function main() {
  if (process.env.SEED_RESET === "1") {
    const old = await prisma.tenant.findMany({ where: { slug: { in: ["kade-retail-demo", "ruchi-restaurant-demo"] } } });
    for (const t of old) {
      await withTenant(
        t.id,
        async (tx) => {
          for (const table of ["SaleLine", "Payment", "Sale", "StockMovement", "StockLevel", "Variant", "Product", "Category", "TaxRule", "TaxClass", "Customer", "Supplier", "DiningTable", "ModifierGroup", "Shift", "AuditLog", "Counter", "SyncOp", "LoyaltyEntry", "Location", "Role"]) {
            await tx.$executeRawUnsafe(`DELETE FROM "${table}"`);
          }
        },
        { client: prisma, timeout: 120_000 },
      );
      await prisma.tenant.delete({ where: { id: t.id } });
    }
  }
  if (await prisma.tenant.findUnique({ where: { slug: "kade-retail-demo" } })) {
    console.log("Demo data already present (set SEED_RESET=1 to recreate).");
    return;
  }
  const ownerId = await user("owner@demo.unipos.app", "Ashen (Owner)");
  const cashierId = await user("cashier@demo.unipos.app", "Nimal (Cashier)");
  const retail = await tenant("Kade Retail (demo)", "kade-retail-demo", ownerId, "retail");
  const restaurant = await tenant("Ruchi Restaurant (demo)", "ruchi-restaurant-demo", ownerId, "restaurant");
  await prisma.member.create({ data: { id: uuidv7(), tenantId: retail.tenantId, userId: cashierId, role: "member", roleId: retail.roles.cashier, displayName: "Nimal", pinHash: await hashPin("2222") } });
  const n = await history(retail.tenantId, retail.memberId, retail.locationId);
  const ctx = await loadMemberContext(retail.memberId, retail.tenantId, prisma);
  await withTenant(retail.tenantId, (tx) => openShift(tx, ctx!, retail.locationId, 500000), { client: prisma });
  console.log(`Seeded retail (${n} historical sales) and restaurant demo tenants.`);
  console.log("Sign in: owner@demo.unipos.app / demo1234 (PIN 1111) · cashier@demo.unipos.app / demo1234 (PIN 2222)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
