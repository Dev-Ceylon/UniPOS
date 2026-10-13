"use server";
import { CustomerInputSchema, parseCustomFields } from "@unipos/core";
import { eraseCustomer, Prisma, writeAudit } from "@unipos/db";
import { z } from "zod";
import { action } from "@/lib/actions";

export async function saveCustomer(id: string | null, input: unknown) {
  return action(
    "customers.edit",
    async (ctx, tx) => {
      const d = CustomerInputSchema.parse(input);
      const customFields = parseCustomFields(ctx.settings.customFields.customer, d.customFields);
      const data = {
        name: d.name,
        phone: d.phone ?? null,
        email: d.email ?? null,
        group: d.group ?? null,
        notes: d.notes ?? null,
        marketingConsent: d.marketingConsent,
        customFields: JSON.parse(JSON.stringify(customFields)) as Prisma.InputJsonValue,
      };
      const before = id ? await tx.customer.findUnique({ where: { id } }) : null;
      const c = id ? await tx.customer.update({ where: { id }, data }) : await tx.customer.create({ data });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, id ? "customer.update" : "customer.create", "Customer", c.id, {
        before: before ? { marketingConsent: before.marketingConsent } : undefined,
        after: { marketingConsent: c.marketingConsent },
      });
      return c.id;
    },
    { module: "customers" },
  );
}

export async function eraseCustomerAction(id: string) {
  return action(
    "customers.privacy",
    async (ctx, tx) => {
      await eraseCustomer(tx, ctx, id);
      return true;
    },
    { module: "customers" },
  );
}

export async function adjustPoints(customerId: string, points: number, reason: string) {
  return action(
    "customers.edit",
    async (ctx, tx) => {
      const p = z
        .number()
        .int()
        .refine((n) => n !== 0)
        .parse(points);
      await tx.loyaltyEntry.create({ data: { customerId, points: p, reason: z.string().trim().min(2).max(100).parse(reason) } });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "loyalty.adjust", "Customer", customerId, { after: { points: p, reason } });
      return true;
    },
    { module: "loyalty" },
  );
}
