import { buildRefundLines, can, ForbiddenError, pointsEarned, refundTenders, uuidv7, type TaxLine } from "@unipos/core";
import { Prisma, type Tx } from "../client";
import { writeAudit } from "./audit";
import type { TenantContext } from "./context";
import { nextNumber } from "./counters";
import { recordMovements } from "./stock";

export class SaleError extends Error {}
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

export interface RefundInput {
  originalSaleId: string;
  lines: { lineId: string; qty: number }[];
  restock: boolean;
  reason: string;
  /** Override tender; default refunds to the original tenders proportionally. */
  tender?: "cash" | "card" | "wallet" | "gift_card" | "other";
  shiftId?: string | null;
}

/** Returns are a Sale with negative lines linked to the original sale. */
export async function createRefund(tx: Tx, ctx: TenantContext, input: RefundInput) {
  if (!can(ctx.member, "sales.refund")) throw new ForbiddenError("sales.refund");
  const original = await tx.sale.findUnique({
    where: { id: input.originalSaleId },
    include: { lines: true, payments: true, refunds: { include: { lines: true } } },
  });
  if (!original || original.isRefund) throw new SaleError("Original sale not found");
  if (original.status !== "completed") throw new SaleError("Only completed sales can be refunded");
  const sold = original.lines.map((l) => ({ id: l.id, qty: l.qty, total: l.total, net: l.net, discount: l.lineDiscount + l.orderDiscount, taxes: l.taxLines as unknown as TaxLine[] }));
  const previous = original.refunds
    .filter((r) => r.status === "completed")
    .flatMap((r) => r.lines.map((l) => ({ originalLineId: l.originalLineId!, qty: Math.abs(l.qty) })));
  const refundLines = buildRefundLines(sold, previous, input.lines.filter((l) => l.qty > 0).map((l) => ({ originalLineId: l.lineId, qty: l.qty })));
  if (refundLines.length === 0) throw new SaleError("Nothing to refund");
  const total = refundLines.reduce((a, l) => a + l.total, 0);
  const taxTotal = refundLines.reduce((a, l) => a + l.taxes.reduce((s, t) => s + t.amount, 0), 0);
  const discountTotal = refundLines.reduce((a, l) => a + l.discount, 0);
  const grossOf = (r: (typeof refundLines)[number]) => r.total - r.taxes.filter((t) => !t.inclusive).reduce((s, t) => s + t.amount, 0) + r.discount;

  const nonRefundable = original.payments.filter((p) => p.tender !== "points");
  const tenders = input.tender
    ? [{ tender: input.tender, amount: total }]
    : refundTenders(total, nonRefundable.length ? nonRefundable : original.payments);

  const id = uuidv7();
  const number = await nextNumber(tx, "refund", "RF");
  const byId = new Map(original.lines.map((l) => [l.id, l]));
  const refund = await tx.sale.create({
    data: {
      id,
      number,
      locationId: original.locationId,
      shiftId: input.shiftId ?? null,
      memberId: ctx.member.id,
      memberName: ctx.member.name,
      customerId: original.customerId,
      status: "completed",
      isRefund: true,
      originalSaleId: original.id,
      subtotal: refundLines.reduce((a, r) => a + grossOf(r), 0),
      discountTotal,
      taxTotal,
      total,
      taxes: json([]),
      note: input.reason,
      createdAt: new Date(),
      lines: {
        create: refundLines.map((r) => {
          const o = byId.get(r.originalLineId)!;
          return {
            id: uuidv7(),
            variantId: o.variantId,
            productId: o.productId,
            name: o.name,
            sku: o.sku,
            categoryName: o.categoryName,
            qty: r.qty,
            unitPrice: o.unitPrice,
            unitCost: o.unitCost,
            modifiers: o.modifiers ?? [],
            lineDiscount: r.discount,
            gross: grossOf(r),
            net: r.net,
            taxTotal: r.taxes.reduce((s, t) => s + t.amount, 0),
            total: r.total,
            taxLines: json(r.taxes),
            originalLineId: r.originalLineId,
          };
        }),
      },
      payments: { create: tenders.map((t) => ({ id: uuidv7(), tender: t.tender, amount: t.amount })) },
    },
    include: { lines: true, payments: true },
  });

  if (input.restock) {
    await recordMovements(
      tx,
      refund.lines.map((l) => ({ variantId: l.variantId, locationId: original.locationId, qtyChange: -l.qty, reason: "return" as const, refType: "sale", refId: id, memberId: ctx.member.id })),
    );
  }
  // gift card refunds go back on the card
  const giftPayment = original.payments.find((p) => p.tender === "gift_card");
  for (const t of tenders.filter((x) => x.tender === "gift_card")) {
    const card = giftPayment?.reference ? await tx.giftCard.findFirst({ where: { code: giftPayment.reference } }) : null;
    if (card) {
      await tx.giftCard.update({ where: { id: card.id }, data: { balance: { increment: -t.amount } } });
      await tx.giftCardEntry.create({ data: { giftCardId: card.id, amount: -t.amount, reason: "refund", saleId: id } });
    }
  }
  if (original.customerId && ctx.settings.loyalty.enabled) {
    const pts = pointsEarned(total, ctx.settings.loyalty);
    if (pts !== 0) await tx.loyaltyEntry.create({ data: { customerId: original.customerId, points: pts, reason: "refund", saleId: id } });
  }
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "sale.refund", "Sale", original.id, {
    after: { refundId: id, number, total, reason: input.reason, lines: input.lines },
  });
  return refund;
}

/** Void a completed sale: status → voided, stock and balances reversed. */
export async function voidSale(tx: Tx, ctx: TenantContext, saleId: string, reason: string) {
  if (!can(ctx.member, "sales.void")) throw new ForbiddenError("sales.void");
  const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lines: true, payments: true, refunds: true } });
  if (!sale) throw new SaleError("Sale not found");
  if (sale.status !== "completed") throw new SaleError("Sale is not completed");
  if (sale.refunds.some((r) => r.status === "completed")) throw new SaleError("Sale has refunds; refund instead of voiding");
  const moves = await tx.stockMovement.findMany({ where: { refType: "sale", refId: saleId } });
  await recordMovements(
    tx,
    moves.map((m) => ({ variantId: m.variantId, locationId: m.locationId, qtyChange: -m.qtyChange, reason: "void" as const, refType: "void", refId: saleId, memberId: ctx.member.id })),
  );
  const gc = await tx.giftCardEntry.findMany({ where: { saleId } });
  for (const e of gc) {
    await tx.giftCard.update({ where: { id: e.giftCardId }, data: { balance: { increment: -e.amount } } });
    await tx.giftCardEntry.create({ data: { giftCardId: e.giftCardId, amount: -e.amount, reason: "void", saleId } });
  }
  const loyalty = await tx.loyaltyEntry.findMany({ where: { saleId } });
  for (const e of loyalty) await tx.loyaltyEntry.create({ data: { customerId: e.customerId, points: -e.points, reason: "void", saleId } });
  const updated = await tx.sale.update({ where: { id: saleId }, data: { status: "voided", voidedAt: new Date(), voidedById: ctx.member.id, voidReason: reason } });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "sale.void", "Sale", saleId, { before: { status: "completed" }, after: { status: "voided", reason } });
  return updated;
}
