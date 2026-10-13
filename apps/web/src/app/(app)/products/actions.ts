"use server";
import { CategoryInputSchema, generateEan13, TaxClassInputSchema, uuidv7 } from "@unipos/core";
import { deleteProduct, importProductsCsv, nextCounter, recordMovements, saveProduct, writeAudit } from "@unipos/db";
import { z } from "zod";
import { action, UserError } from "@/lib/actions";

export async function saveProductAction(id: string | null, input: unknown, openingStock: Record<number, number> = {}) {
  return action("products.edit", async (ctx, tx) => {
    const p = await saveProduct(tx, ctx, input, id ?? undefined);
    // Opening stock for new variants goes through the ledger.
    if (!id) {
      const moves = p.variants
        .map((v, i) => ({ variantId: v.id, locationId: ctx.locationId, qtyChange: Math.trunc(openingStock[i] ?? 0), reason: "opening" as const, memberId: ctx.member.id }))
        .filter((mv) => mv.qtyChange > 0);
      if (moves.length && p.trackStock) await recordMovements(tx, moves);
    }
    return { id: p.id };
  });
}

export async function deleteProductAction(id: string) {
  return action("products.edit", async (ctx, tx) => {
    await deleteProduct(tx, ctx, id);
    return true;
  });
}

export async function generateBarcode() {
  return action("products.edit", async (_ctx, tx) => {
    for (let i = 0; i < 5; i++) {
      const code = generateEan13(await nextCounter(tx, "barcode"), "20");
      if (!(await tx.variant.findFirst({ where: { barcode: code } }))) return code;
    }
    throw new UserError("Could not generate a unique barcode");
  });
}

export async function saveCategory(id: string | null, input: unknown) {
  return action("products.edit", async (ctx, tx) => {
    const d = CategoryInputSchema.parse(input);
    const c = id ? await tx.category.update({ where: { id }, data: d }) : await tx.category.create({ data: d });
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, id ? "category.update" : "category.create", "Category", c.id);
    return c.id;
  });
}

export async function deleteCategory(id: string) {
  return action("products.edit", async (ctx, tx) => {
    await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
    await tx.category.updateMany({ where: { parentId: id }, data: { parentId: null } });
    await tx.category.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "category.delete", "Category", id);
    return true;
  });
}

export async function saveTaxClass(id: string | null, input: unknown) {
  return action("settings.edit", async (ctx, tx) => {
    const d = TaxClassInputSchema.parse(input);
    let classId = id;
    if (id) {
      await tx.taxClass.update({ where: { id }, data: { name: d.name } });
      const keep = d.rules.filter((r) => r.id).map((r) => r.id!);
      await tx.taxRule.deleteMany({ where: { taxClassId: id, id: { notIn: keep } } });
      for (const r of d.rules) {
        const data = { name: r.name, rateBp: r.rateBp, inclusive: r.inclusive, compound: r.compound, region: r.region ?? null, priority: r.priority };
        if (r.id) await tx.taxRule.update({ where: { id: r.id }, data });
        else await tx.taxRule.create({ data: { ...data, taxClassId: id } });
      }
    } else {
      const tc = await tx.taxClass.create({ data: { name: d.name, rules: { create: d.rules.map((r) => ({ name: r.name, rateBp: r.rateBp, inclusive: r.inclusive, compound: r.compound, region: r.region ?? null, priority: r.priority })) } } });
      classId = tc.id;
    }
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "tax.save", "TaxClass", classId, { after: d });
    return classId;
  });
}

export async function deleteTaxClass(id: string) {
  return action("settings.edit", async (ctx, tx) => {
    await tx.product.updateMany({ where: { taxClassId: id }, data: { taxClassId: null } });
    await tx.taxClass.update({ where: { id }, data: { deletedAt: new Date() } });
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "tax.delete", "TaxClass", id);
    return true;
  });
}

export async function importCsvAction(text: string) {
  return action(
    "products.import",
    async (ctx, tx) => {
      if (text.length > 20_000_000) throw new UserError("File is too large (max 20 MB)");
      return importProductsCsv(tx, ctx, text, ctx.locationId);
    },
    { timeout: 300_000 },
  );
}

const ModifierGroupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  minSelect: z.number().int().min(0).max(10),
  maxSelect: z.number().int().min(1).max(20),
  modifiers: z.array(z.object({ name: z.string().trim().min(1).max(60), priceDelta: z.number().int() })).min(1).max(30),
});

export async function saveModifierGroup(id: string | null, input: unknown) {
  return action(
    "restaurant.manage",
    async (ctx, tx) => {
      const d = ModifierGroupSchema.parse(input);
      if (d.minSelect > d.maxSelect) throw new UserError("Minimum cannot exceed maximum");
      const g = id ? await tx.modifierGroup.update({ where: { id }, data: d }) : await tx.modifierGroup.create({ data: { ...d, id: uuidv7() } });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "modifiers.save", "ModifierGroup", g.id);
      return g.id;
    },
    { module: "restaurant" },
  );
}

export async function deleteModifierGroup(id: string) {
  return action(
    "restaurant.manage",
    async (_ctx, tx) => {
      await tx.modifierGroup.update({ where: { id }, data: { deletedAt: new Date() } });
      return true;
    },
    { module: "restaurant" },
  );
}
