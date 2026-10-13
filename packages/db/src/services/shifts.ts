import { cashVariance, countDenominations, expectedCash, ForbiddenError, can } from "@unipos/core";
import { Prisma, type Tx } from "../client";
import { writeAudit } from "./audit";
import type { TenantContext } from "./context";

export class ShiftError extends Error {}

export async function currentShift(tx: Tx, locationId: string, memberId?: string) {
  return tx.shift.findFirst({ where: { locationId, closedAt: null, ...(memberId ? { memberId } : {}) }, orderBy: { openedAt: "desc" } });
}

export async function openShift(tx: Tx, ctx: TenantContext, locationId: string, openingFloat: number) {
  if (!can(ctx.member, "shifts.manage")) throw new ForbiddenError("shifts.manage");
  if (!Number.isInteger(openingFloat) || openingFloat < 0) throw new ShiftError("Opening float must be ≥ 0");
  const open = await currentShift(tx, locationId);
  if (open) throw new ShiftError("A shift is already open at this location");
  const shift = await tx.shift.create({ data: { locationId, memberId: ctx.member.id, openingFloat } });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "shift.open", "Shift", shift.id, { after: { openingFloat } });
  return shift;
}

export async function shiftTotals(tx: Tx, shiftId: string) {
  const shift = await tx.shift.findUniqueOrThrow({ where: { id: shiftId } });
  const cashPayments = await tx.payment.findMany({ where: { tender: "cash", sale: { shiftId, status: "completed" } }, select: { amount: true } });
  const allPayments = await tx.payment.groupBy({ by: ["tender"], where: { sale: { shiftId, status: "completed" } }, _sum: { amount: true } });
  const moves = await tx.cashMovement.findMany({ where: { shiftId } });
  const cashSales = cashPayments.filter((p) => p.amount > 0).reduce((a, p) => a + p.amount, 0);
  const cashRefunds = -cashPayments.filter((p) => p.amount < 0).reduce((a, p) => a + p.amount, 0);
  const cashIn = moves.filter((m) => m.type === "in").reduce((a, m) => a + m.amount, 0);
  const cashOut = moves.filter((m) => m.type === "out").reduce((a, m) => a + m.amount, 0);
  const salesAgg = await tx.sale.aggregate({ where: { shiftId, status: "completed" }, _sum: { total: true }, _count: true });
  return {
    shift,
    cashSales,
    cashRefunds,
    cashIn,
    cashOut,
    expected: expectedCash({ openingFloat: shift.openingFloat, cashSales, cashRefunds, cashIn, cashOut }),
    byTender: allPayments.map((p) => ({ tender: p.tender, amount: p._sum.amount ?? 0 })),
    salesTotal: salesAgg._sum.total ?? 0,
    salesCount: salesAgg._count,
    movements: moves,
  };
}

export async function closeShift(tx: Tx, ctx: TenantContext, shiftId: string, counted: { amount?: number; denominations?: Record<string, number> }, note?: string) {
  if (!can(ctx.member, "shifts.manage")) throw new ForbiddenError("shifts.manage");
  const t = await shiftTotals(tx, shiftId);
  if (t.shift.closedAt) throw new ShiftError("Shift already closed");
  if (t.shift.memberId !== ctx.member.id && !can(ctx.member, "shifts.view_all")) throw new ForbiddenError("shifts.view_all");
  const countedCash = counted.denominations ? countDenominations(counted.denominations) : counted.amount;
  if (countedCash === undefined || !Number.isInteger(countedCash) || countedCash < 0) throw new ShiftError("Counted cash is required");
  const variance = cashVariance(t.expected, countedCash);
  const shift = await tx.shift.update({
    where: { id: shiftId },
    data: { closedAt: new Date(), countedCash, expectedCash: t.expected, variance, denominations: counted.denominations ?? Prisma.JsonNull, note },
  });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "shift.close", "Shift", shiftId, { after: { countedCash, expected: t.expected, variance } });
  return { ...t, shift, variance };
}
