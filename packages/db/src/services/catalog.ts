import {
  can,
  ForbiddenError,
  parseCsvObjects,
  parseCustomFields,
  parseMoney,
  ProductInputSchema,
  toCsv,
  toDecimalString,
  type ProductInput,
} from "@unipos/core";
import { Prisma, type Tx } from "../client";
import { writeAudit } from "./audit";
import type { TenantContext } from "./context";
import { recordMovements } from "./stock";

export class CatalogError extends Error {}
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/** Create or update a product with its variants. Removed variants are soft-deleted. */
export async function saveProduct(tx: Tx, ctx: TenantContext, raw: unknown, productId?: string) {
  if (!can(ctx.member, "products.edit")) throw new ForbiddenError("products.edit");
  const input: ProductInput = ProductInputSchema.parse(raw);
  const customFields = parseCustomFields(ctx.settings.customFields.product, input.customFields);
  const data = {
    name: input.name,
    description: input.description ?? null,
    categoryId: input.categoryId || null,
    taxClassId: input.taxClassId || null,
    type: input.type,
    unit: input.unit,
    trackStock: input.type === "service" ? false : input.trackStock,
    favourite: input.favourite,
    imageUrl: input.imageUrl ?? null,
    modifierGroupIds: input.modifierGroupIds,
    customFields: json(customFields),
  };
  try {
    if (!productId) {
      const p = await tx.product.create({
        data: {
          ...data,
          variants: {
            create: input.variants.map((v) => ({
              name: v.name,
              sku: v.sku ?? null,
              barcode: v.barcode ?? null,
              options: json(v.options),
              price: v.price,
              cost: v.cost,
            })),
          },
        },
        include: { variants: true },
      });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "product.create", "Product", p.id, { after: { name: p.name } });
      return p;
    }
    const before = await tx.product.findUnique({ where: { id: productId }, include: { variants: { where: { deletedAt: null } } } });
    if (!before || before.deletedAt) throw new CatalogError("Product not found");
    await tx.product.update({ where: { id: productId }, data });
    const keep = new Set(input.variants.filter((v) => v.id).map((v) => v.id!));
    for (const v of before.variants) {
      if (!keep.has(v.id)) await tx.variant.update({ where: { id: v.id }, data: { deletedAt: new Date(), sku: null, barcode: null } });
    }
    for (const v of input.variants) {
      const d = { name: v.name, sku: v.sku ?? null, barcode: v.barcode ?? null, options: json(v.options), price: v.price, cost: v.cost };
      if (v.id && before.variants.some((b) => b.id === v.id)) await tx.variant.update({ where: { id: v.id }, data: d });
      else await tx.variant.create({ data: { ...d, productId } });
    }
    const priceChanges = input.variants
      .filter((v) => v.id)
      .map((v) => ({ id: v.id, before: before.variants.find((b) => b.id === v.id)?.price, after: v.price }))
      .filter((c) => c.before !== undefined && c.before !== c.after);
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "product.update", "Product", productId, {
      before: { name: before.name, prices: priceChanges.map((c) => c.before) },
      after: { name: input.name, prices: priceChanges.map((c) => c.after) },
    });
    return tx.product.findUniqueOrThrow({ where: { id: productId }, include: { variants: { where: { deletedAt: null } } } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new CatalogError("SKU or barcode already used by another product");
    throw e;
  }
}

export async function deleteProduct(tx: Tx, ctx: TenantContext, productId: string) {
  if (!can(ctx.member, "products.edit")) throw new ForbiddenError("products.edit");
  await tx.variant.updateMany({ where: { productId }, data: { deletedAt: new Date(), sku: null, barcode: null } });
  await tx.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "product.delete", "Product", productId);
}

export const PRODUCT_CSV_COLUMNS = [
  "name",
  "variant",
  "sku",
  "barcode",
  "category",
  "price",
  "cost",
  "tax_class",
  "track_stock",
  "stock",
  "reorder_point",
  "unit",
  "favourite",
] as const;

export async function exportProductsCsv(tx: Tx, ctx: TenantContext, locationId?: string) {
  const variants = await tx.variant.findMany({
    where: { deletedAt: null, product: { deletedAt: null } },
    include: { product: { include: { category: true, taxClass: true } }, stockLevels: locationId ? { where: { locationId } } : true },
    orderBy: [{ product: { name: "asc" } }, { name: "asc" }],
  });
  return toCsv(
    variants.map((v) => ({
      name: v.product.name,
      variant: v.name,
      sku: v.sku ?? "",
      barcode: v.barcode ?? "",
      category: v.product.category?.name ?? "",
      price: toDecimalString(v.price, ctx.currency),
      cost: toDecimalString(v.cost, ctx.currency),
      tax_class: v.product.taxClass?.name ?? "",
      track_stock: v.product.trackStock ? "yes" : "no",
      stock: v.stockLevels.reduce((a, s) => a + s.onHand, 0),
      reorder_point: v.stockLevels[0]?.reorderPoint ?? "",
      unit: v.product.unit,
      favourite: v.product.favourite ? "yes" : "no",
    })),
    PRODUCT_CSV_COLUMNS,
  );
}

export interface ImportResult {
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}

/**
 * Import products from CSV. Rows are matched by SKU (update) or created.
 * Rows with the same name become variants of one product.
 */
export async function importProductsCsv(tx: Tx, ctx: TenantContext, text: string, locationId: string): Promise<ImportResult> {
  if (!can(ctx.member, "products.import")) throw new ForbiddenError("products.import");
  const rows = parseCsvObjects(text);
  const result: ImportResult = { created: 0, updated: 0, errors: [] };
  const categories = new Map((await tx.category.findMany({ where: { deletedAt: null } })).map((c) => [c.name.toLowerCase(), c.id]));
  const taxClasses = new Map((await tx.taxClass.findMany({ where: { deletedAt: null } })).map((c) => [c.name.toLowerCase(), c.id]));
  const existingBySku = new Map(
    (await tx.variant.findMany({ where: { deletedAt: null, sku: { not: null } }, select: { id: true, sku: true, productId: true } })).map((v) => [
      v.sku!.toLowerCase(),
      v,
    ]),
  );
  const productByName = new Map<string, string>();
  const yes = (v?: string) => /^(y|yes|true|1)$/i.test(v ?? "");
  const levelUpdates: { variantId: string; stock: number | null; reorder: number | null }[] = [];

  for (const [i, r] of rows.entries()) {
    const rowNo = i + 2;
    try {
      if (!r.name) throw new Error("name is required");
      const price = parseMoney(r.price || "0", ctx.currency);
      const cost = parseMoney(r.cost || "0", ctx.currency);
      if (price < 0 || cost < 0) throw new Error("price and cost must be ≥ 0");
      let categoryId: string | null = null;
      if (r.category) {
        categoryId = categories.get(r.category.toLowerCase()) ?? null;
        if (!categoryId) {
          categoryId = (await tx.category.create({ data: { name: r.category } })).id;
          categories.set(r.category.toLowerCase(), categoryId);
        }
      }
      const taxClassId = r.tax_class ? (taxClasses.get(r.tax_class.toLowerCase()) ?? null) : null;
      if (r.tax_class && !taxClassId) throw new Error(`unknown tax class "${r.tax_class}"`);
      const stock = r.stock ? Number(r.stock) : null;
      const reorder = r.reorder_point ? Number(r.reorder_point) : null;
      if ((stock !== null && !Number.isInteger(stock)) || (reorder !== null && !Number.isInteger(reorder)))
        throw new Error("stock and reorder_point must be whole numbers");
      const sku = r.sku || null;
      const existing = sku ? existingBySku.get(sku.toLowerCase()) : undefined;
      const trackStock = r.track_stock ? yes(r.track_stock) : ctx.settings.trackStockByDefault;
      if (existing) {
        await tx.variant.update({ where: { id: existing.id }, data: { price, cost, barcode: r.barcode || undefined, name: r.variant ?? "" } });
        await tx.product.update({
          where: { id: existing.productId },
          data: { name: r.name, categoryId, taxClassId, trackStock, unit: r.unit || "each", favourite: yes(r.favourite) },
        });
        levelUpdates.push({ variantId: existing.id, stock, reorder });
        result.updated++;
        continue;
      }
      const key = r.name.toLowerCase();
      let productId = productByName.get(key);
      if (!productId) {
        const p = await tx.product.create({ data: { name: r.name, categoryId, taxClassId, trackStock, unit: r.unit || "each", favourite: yes(r.favourite) } });
        productId = p.id;
        productByName.set(key, productId);
      }
      const v = await tx.variant.create({ data: { productId, name: r.variant ?? "", sku, barcode: r.barcode || null, price, cost } });
      if (sku) existingBySku.set(sku.toLowerCase(), { id: v.id, sku, productId });
      levelUpdates.push({ variantId: v.id, stock, reorder });
      result.created++;
    } catch (e) {
      const msg = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" ? "duplicate SKU or barcode" : (e as Error).message;
      result.errors.push({ row: rowNo, message: msg });
      if (result.errors.length > 200) break;
    }
  }
  // Set stock (as a "set" adjustment through the ledger) and reorder points.
  const levels = new Map(
    (await tx.stockLevel.findMany({ where: { locationId, variantId: { in: levelUpdates.map((l) => l.variantId) } } })).map((l) => [l.variantId, l]),
  );
  await recordMovements(
    tx,
    levelUpdates
      .filter((u) => u.stock !== null)
      .map((u) => ({
        variantId: u.variantId,
        locationId,
        qtyChange: u.stock! - (levels.get(u.variantId)?.onHand ?? 0),
        reason: "adjust" as const,
        note: "CSV import",
        memberId: ctx.member.id,
      })),
  );
  for (const u of levelUpdates.filter((x) => x.reorder !== null)) {
    await tx.stockLevel.upsert({
      where: { variantId_locationId: { variantId: u.variantId, locationId } },
      create: { variantId: u.variantId, locationId, onHand: 0, reorderPoint: u.reorder },
      update: { reorderPoint: u.reorder },
    });
  }
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "product.import", "Product", null, {
    after: { created: result.created, updated: result.updated, errors: result.errors.length },
  });
  return result;
}
