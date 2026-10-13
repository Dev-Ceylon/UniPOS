"use server";
import { createRefund, voidSale } from "@unipos/db";
import { z } from "zod";
import { action } from "@/lib/actions";

const RefundSchema = z.object({
  saleId: z.string(),
  lines: z.array(z.object({ lineId: z.string(), qty: z.number().int().min(0) })),
  restock: z.boolean(),
  reason: z.string().trim().min(2, "Give a reason").max(200),
  tender: z.enum(["original", "cash", "card", "wallet", "gift_card", "other"]),
});

export async function refundAction(input: z.infer<typeof RefundSchema>) {
  return action("sales.refund", async (ctx, tx) => {
    const d = RefundSchema.parse(input);
    const shift = await tx.shift.findFirst({ where: { locationId: ctx.locationId, closedAt: null } });
    const r = await createRefund(tx, ctx, {
      originalSaleId: d.saleId,
      lines: d.lines,
      restock: d.restock,
      reason: d.reason,
      tender: d.tender === "original" ? undefined : d.tender,
      shiftId: shift?.id,
    });
    return { id: r.id, number: r.number };
  });
}

export async function voidAction(saleId: string, reason: string) {
  return action("sales.void", async (ctx, tx) => {
    const r = z.string().trim().min(2, "Give a reason").max(200).parse(reason);
    await voidSale(tx, ctx, saleId, r);
    return true;
  });
}

export async function clearFlags(saleId: string) {
  return action("sales.void", async (ctx, tx) => {
    const sale = await tx.sale.update({ where: { id: saleId }, data: { flags: [] } });
    await tx.auditLog.create({ data: { actorId: ctx.member.id, actorName: ctx.member.name, action: "sale.review", entity: "Sale", entityId: sale.id } });
    return true;
  });
}
