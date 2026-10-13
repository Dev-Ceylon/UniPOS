import { can, ForbiddenError, generateEan13 } from "@unipos/core";
import type { Tx } from "../client";
import { writeAudit } from "./audit";
import type { TenantContext } from "./context";
import { nextCounter } from "./counters";

export async function loyaltyBalance(tx: Tx, customerId: string) {
  const agg = await tx.loyaltyEntry.aggregate({ where: { customerId }, _sum: { points: true } });
  return agg._sum.points ?? 0;
}

/** Everything held about a customer (personal-data access request). */
export async function exportCustomerData(tx: Tx, ctx: TenantContext, customerId: string) {
  if (!can(ctx.member, "customers.privacy")) throw new ForbiddenError("customers.privacy");
  const customer = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
  const sales = await tx.sale.findMany({ where: { customerId }, include: { lines: true, payments: true }, orderBy: { createdAt: "asc" } });
  const loyalty = await tx.loyaltyEntry.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });
  const giftCards = await tx.giftCard.findMany({ where: { customerId }, include: { entries: true } });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "customer.export", "Customer", customerId);
  return { exportedAt: new Date().toISOString(), customer, sales, loyalty, giftCards };
}

/**
 * Erase a customer's personal data. Sales stay (accounting records) but are
 * detached; the profile is anonymised and loyalty history removed.
 */
export async function eraseCustomer(tx: Tx, ctx: TenantContext, customerId: string) {
  if (!can(ctx.member, "customers.privacy")) throw new ForbiddenError("customers.privacy");
  await tx.sale.updateMany({ where: { customerId }, data: { customerId: null } });
  await tx.loyaltyEntry.deleteMany({ where: { customerId } });
  await tx.giftCard.updateMany({ where: { customerId }, data: { customerId: null } });
  await tx.customer.update({
    where: { id: customerId },
    data: { name: "Erased customer", phone: null, email: null, notes: null, group: null, customFields: {}, marketingConsent: false, deletedAt: new Date() },
  });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "customer.erase", "Customer", customerId);
}

export async function issueGiftCard(tx: Tx, ctx: TenantContext, input: { value: number; customerId?: string | null; code?: string; expiresAt?: Date | null }) {
  if (!can(ctx.member, "giftcards.manage")) throw new ForbiddenError("giftcards.manage");
  if (!Number.isInteger(input.value) || input.value <= 0) throw new Error("Value must be positive");
  const code = (input.code?.trim().toUpperCase() || generateEan13(await nextCounter(tx, "giftcard"), "29")).slice(0, 32);
  const card = await tx.giftCard.create({
    data: {
      code,
      initialValue: input.value,
      balance: input.value,
      customerId: input.customerId ?? null,
      expiresAt: input.expiresAt ?? null,
      entries: { create: [{ amount: input.value, reason: "issue" }] },
    },
  });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "giftcard.issue", "GiftCard", card.id, { after: { code, value: input.value } });
  return card;
}
