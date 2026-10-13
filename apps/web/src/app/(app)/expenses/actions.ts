"use server";
import { parseMoney } from "@unipos/core";
import { writeAudit } from "@unipos/db";
import { z } from "zod";
import { action } from "@/lib/actions";

const ExpenseSchema = z.object({
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(200),
  amount: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reference: z.string().trim().max(100).optional(),
});

export async function addExpense(input: unknown) {
  return action(
    "expenses.manage",
    async (ctx, tx) => {
      const d = ExpenseSchema.parse(input);
      const amount = parseMoney(d.amount, ctx.currency);
      if (amount <= 0) throw new Error("Amount must be positive");
      const e = await tx.expense.create({
        data: {
          category: d.category,
          description: d.description,
          amount,
          date: new Date(`${d.date}T12:00:00Z`),
          reference: d.reference || null,
          locationId: ctx.locationId,
          memberId: ctx.member.id,
        },
      });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "expense.create", "Expense", e.id, { after: { amount, category: d.category } });
      return e.id;
    },
    { module: "expenses" },
  );
}

export async function deleteExpense(id: string) {
  return action(
    "expenses.manage",
    async (ctx, tx) => {
      const before = await tx.expense.delete({ where: { id } });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "expense.delete", "Expense", id, {
        before: { amount: before.amount, description: before.description },
      });
      return true;
    },
    { module: "expenses" },
  );
}
