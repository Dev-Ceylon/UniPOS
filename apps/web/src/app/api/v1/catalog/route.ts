import { rulesForRegion, type TaxRule } from "@unipos/core";
import { withTenant } from "@unipos/db";
import { NextResponse } from "next/server";
import { apiContext, json } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Catalog snapshot for the register's offline cache (Dexie): products with
 * prices, taxes for this location's region, categories, modifiers, customers.
 */
export async function GET(req: Request) {
  const ctx = await apiContext("register.use");
  if (ctx instanceof NextResponse) return ctx;
  const url = new URL(req.url);
  const locationId = url.searchParams.get("locationId") ?? ctx.locationId;
  const location = ctx.locations.find((l) => l.id === locationId);
  if (!location) return json({ error: "unknown location" }, { status: 400 });

  const data = await withTenant(ctx.tenantId, async (tx) => {
    const [variants, categories, modifierGroups, taxClasses, customers, loyalty] = await Promise.all([
      tx.variant.findMany({
        where: { deletedAt: null, product: { deletedAt: null } },
        include: { product: { include: { category: true } }, stockLevels: { where: { locationId } } },
        orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
      }),
      tx.category.findMany({ where: { deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      tx.modifierGroup.findMany({ where: { deletedAt: null } }),
      tx.taxClass.findMany({ where: { deletedAt: null }, include: { rules: true } }),
      ctx.tenant.modules.includes("customers") ? tx.customer.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 5000 }) : [],
      ctx.tenant.modules.includes("loyalty") ? tx.loyaltyEntry.groupBy({ by: ["customerId"], _sum: { points: true } }) : [],
    ]);
    const taxByClass = new Map(
      taxClasses.map((tc) => [
        tc.id,
        rulesForRegion(tc.rules, location.taxRegion).map((r): TaxRule => ({ id: r.id, name: r.name, rateBp: r.rateBp, inclusive: r.inclusive, compound: r.compound, priority: r.priority })),
      ]),
    );
    const points = new Map(loyalty.map((l) => [l.customerId, l._sum.points ?? 0]));
    return {
      products: variants.map((v) => ({
        id: v.id,
        productId: v.productId,
        name: v.product.name,
        variantName: v.name,
        sku: v.sku,
        barcode: v.barcode,
        price: v.price,
        cost: v.cost,
        categoryId: v.product.categoryId,
        categoryName: v.product.category?.name ?? null,
        taxRules: v.product.taxClassId ? (taxByClass.get(v.product.taxClassId) ?? []) : [],
        favourite: v.product.favourite ? 1 : 0,
        trackStock: v.product.trackStock,
        type: v.product.type,
        onHand: v.product.trackStock ? (v.stockLevels[0]?.onHand ?? 0) : null,
        modifierGroupIds: v.product.modifierGroupIds,
        imageUrl: v.product.imageUrl,
      })),
      categories: categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder, color: c.color })),
      modifierGroups: modifierGroups.map((g) => ({ id: g.id, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, modifiers: g.modifiers as { name: string; priceDelta: number }[] })),
      customers: customers.map((c) => ({ id: c.id, name: c.name, phone: c.phone, email: c.email, points: points.get(c.id) ?? 0 })),
    };
  });
  return json({ ...data, locationId, generatedAt: new Date().toISOString() }, { headers: { "cache-control": "no-store" } });
}
