import { computeCart, DEFAULT_ROLES, parseSettings, uuidv7, type SalePayload, type TaxRule } from "@unipos/core";
import { createPrismaClient, withTenant, type PrismaClient } from "../src/client";
import { bootstrapTenant } from "../src/services/tenant";
import type { TenantContext } from "../src/services/context";

export const db: PrismaClient = createPrismaClient(process.env.DATABASE_URL);

export interface TestTenant {
  tenantId: string;
  ownerMemberId: string;
  locationId: string;
  ctx: TenantContext;
  roles: Record<string, string>;
}

export async function createTenant(name = "Shop", opts: { seedDemo?: boolean; loyalty?: boolean; type?: "retail" | "restaurant" } = {}): Promise<TestTenant> {
  const tenantId = uuidv7();
  const userId = uuidv7();
  const memberId = uuidv7();
  await db.user.create({ data: { id: userId, name: `${name} Owner`, email: `${userId}@example.com` } });
  await db.tenant.create({ data: { id: tenantId, name, slug: `${name.toLowerCase().replace(/\W+/g, "-")}-${tenantId.slice(-6)}` } });
  await db.member.create({ data: { id: memberId, tenantId, userId, role: "owner" } });
  const { locationId, roles } = await bootstrapTenant(
    {
      tenantId,
      ownerMemberId: memberId,
      ownerName: `${name} Owner`,
      businessType: opts.type ?? "retail",
      currency: "LKR",
      locale: "en",
      timezone: "Asia/Colombo",
      locationName: "Main",
      taxName: "VAT",
      taxRateBp: 1800,
      taxInclusive: true,
      seedDemo: opts.seedDemo ?? false,
    },
    db,
  );
  if (opts.loyalty) {
    const t = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    await db.tenant.update({ where: { id: tenantId }, data: { settings: { ...(t.settings as object), loyalty: { enabled: true, spendPerPoint: 10000, pointValue: 100, minRedeem: 0 } } } });
  }
  const t = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const ctx: TenantContext = {
    tenantId,
    currency: "LKR",
    timezone: "Asia/Colombo",
    locale: "en",
    settings: parseSettings(t.settings),
    enabledModules: t.enabledModules,
    member: { id: memberId, name: `${name} Owner`, permissions: ["*"], allowedLocationIds: [] },
  };
  return { tenantId, ownerMemberId: memberId, locationId, ctx, roles };
}

export async function addMember(t: TestTenant, roleKey: keyof typeof DEFAULT_ROLES): Promise<TenantContext> {
  const userId = uuidv7();
  const memberId = uuidv7();
  await db.user.create({ data: { id: userId, name: `${roleKey} user`, email: `${userId}@example.com` } });
  await db.member.create({ data: { id: memberId, tenantId: t.tenantId, userId, role: "member", roleId: t.roles[roleKey]! } });
  return { ...t.ctx, member: { id: memberId, name: `${roleKey} user`, permissions: [...DEFAULT_ROLES[roleKey]!.permissions], allowedLocationIds: [] } };
}

export async function createProduct(t: TestTenant, name: string, price: number, opts: { stock?: number; cost?: number; trackStock?: boolean; sku?: string } = {}) {
  return withTenant(
    t.tenantId,
    async (tx) => {
      const tc = await tx.taxClass.findFirst({ where: { name: "Standard" }, include: { rules: true } });
      const p = await tx.product.create({
        data: { name, taxClassId: tc?.id, trackStock: opts.trackStock ?? true, variants: { create: [{ price, cost: opts.cost ?? 0, sku: opts.sku ?? `SKU-${uuidv7().slice(-8)}` }] } },
        include: { variants: true },
      });
      const v = p.variants[0]!;
      if (opts.stock) {
        await tx.stockMovement.create({ data: { variantId: v.id, locationId: t.locationId, qtyChange: opts.stock, reason: "opening" } });
        await tx.stockLevel.create({ data: { variantId: v.id, locationId: t.locationId, onHand: opts.stock } });
      }
      const rules: TaxRule[] = (tc?.rules ?? []).map((r) => ({ id: r.id, name: r.name, rateBp: r.rateBp, inclusive: r.inclusive, compound: r.compound }));
      return { product: p, variant: v, rules };
    },
    { client: db },
  );
}

export function salePayload(
  t: TestTenant,
  items: { variantId: string; price: number; qty: number; rules: TaxRule[]; name?: string }[],
  opts: { tender?: "cash" | "card" | "gift_card" | "points"; reference?: string; customerId?: string; shiftId?: string; memberId?: string; extraCash?: number } = {},
): SalePayload {
  const lines = items.map((i) => ({ id: uuidv7(), variantId: i.variantId, name: i.name ?? "Item", qty: i.qty, unitPrice: i.price, modifiers: [], taxRules: i.rules }));
  const totals = computeCart({ lines: lines.map((l) => ({ ...l, discount: null })) });
  const tender = opts.tender ?? "cash";
  const extra = tender === "cash" ? (opts.extraCash ?? 0) : 0;
  return {
    clientId: uuidv7(),
    number: `T-${Math.random().toString(36).slice(2, 8)}`,
    locationId: t.locationId,
    memberId: opts.memberId ?? t.ownerMemberId,
    customerId: opts.customerId ?? null,
    shiftId: opts.shiftId ?? null,
    createdAt: new Date().toISOString(),
    lines,
    payments: [{ id: uuidv7(), tender, amount: totals.total + extra, reference: opts.reference ?? null }],
    change: extra,
    expected: { total: totals.total, taxTotal: totals.taxTotal },
  };
}
