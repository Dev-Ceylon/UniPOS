"use server";
import { parseMoney } from "@unipos/core";
import { createPurchaseOrder, markOrdered, receivePurchaseOrder, writeAudit } from "@unipos/db";
import { z } from "zod";
import { action, UserError } from "@/lib/actions";

const SupplierSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contact: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.literal(""), z.string().email()]).optional(),
  address: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function saveSupplier(id: string | null, input: unknown) {
  return action(
    "purchasing.manage",
    async (ctx, tx) => {
      const d = SupplierSchema.parse(input);
      const data = { ...d, email: d.email || null };
      const s = id ? await tx.supplier.update({ where: { id }, data }) : await tx.supplier.create({ data });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, id ? "supplier.update" : "supplier.create", "Supplier", s.id);
      return s.id;
    },
    { module: "purchasing" },
  );
}

export async function createPoAction(input: { supplierId: string; expectedAt: string; note: string; lines: { variantId: string; qty: number; unitCost: string }[] }) {
  return action(
    "purchasing.manage",
    async (ctx, tx) => {
      if (!input.supplierId) throw new UserError("Choose a supplier");
      const po = await createPurchaseOrder(tx, ctx, {
        supplierId: input.supplierId,
        locationId: ctx.locationId,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        note: input.note || undefined,
        lines: input.lines.map((l) => ({ variantId: l.variantId, qty: Math.trunc(l.qty), unitCost: parseMoney(l.unitCost || "0", ctx.currency) })),
      });
      return po.id;
    },
    { module: "purchasing" },
  );
}

export async function poStep(id: string, step: "order" | "cancel") {
  return action(
    "purchasing.manage",
    async (ctx, tx) => {
      if (step === "order") await markOrdered(tx, ctx, id);
      else {
        const po = await tx.purchaseOrder.findUnique({ where: { id } });
        if (!po || !["draft", "ordered"].includes(po.status)) throw new UserError("Only draft or ordered POs can be cancelled");
        await tx.purchaseOrder.update({ where: { id }, data: { status: "cancelled" } });
      }
      return true;
    },
    { module: "purchasing" },
  );
}

export async function receivePoAction(id: string, received: Record<string, number>) {
  return action("purchasing.manage", (ctx, tx) => receivePurchaseOrder(tx, ctx, id, received), { module: "purchasing" });
}
