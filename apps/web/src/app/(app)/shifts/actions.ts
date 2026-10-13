"use server";
import { parseMoney, uuidv7 } from "@unipos/core";
import { closeShift, openShift, writeAudit } from "@unipos/db";
import { z } from "zod";
import { action, UserError } from "@/lib/actions";

export async function openShiftForm(openingFloat: string) {
  return action("shifts.manage", async (ctx, tx) => {
    const s = await openShift(tx, ctx, ctx.locationId, parseMoney(openingFloat || "0", ctx.currency));
    return s.id;
  });
}

export async function cashMove(shiftId: string, type: "in" | "out", amount: string, reason: string) {
  return action("shifts.manage", async (ctx, tx) => {
    const amt = parseMoney(amount, ctx.currency);
    if (amt <= 0) throw new UserError("Amount must be positive");
    const r = z.string().trim().min(2, "Give a reason").max(200).parse(reason);
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift || shift.closedAt) throw new UserError("Shift is not open");
    await tx.cashMovement.create({ data: { id: uuidv7(), shiftId, type, amount: amt, reason: r, memberId: ctx.member.id } });
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, `cash.${type}`, "Shift", shiftId, { after: { amount: amt, reason: r } });
    return true;
  });
}

export async function closeShiftForm(shiftId: string, denominations: Record<string, number>, note: string) {
  return action("shifts.manage", async (ctx, tx) => {
    const clean = Object.fromEntries(Object.entries(denominations).filter(([, n]) => n > 0));
    const res = await closeShift(tx, ctx, shiftId, { denominations: clean }, note || undefined);
    return { expected: res.expected, counted: res.shift.countedCash, variance: res.variance };
  });
}
