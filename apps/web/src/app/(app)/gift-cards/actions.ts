"use server";
import { parseMoney } from "@unipos/core";
import { issueGiftCard, writeAudit } from "@unipos/db";
import { action, UserError } from "@/lib/actions";

export async function issueGiftCardAction(input: { value: string; code: string; customerId: string; expiresAt: string }) {
  return action(
    "giftcards.manage",
    async (ctx, tx) => {
      const card = await issueGiftCard(tx, ctx, {
        value: parseMoney(input.value, ctx.currency),
        code: input.code || undefined,
        customerId: input.customerId || null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      });
      return card.code;
    },
    { module: "giftcards" },
  );
}

export async function toggleGiftCard(id: string, active: boolean) {
  return action(
    "giftcards.manage",
    async (ctx, tx) => {
      const card = await tx.giftCard.findUnique({ where: { id } });
      if (!card) throw new UserError("Not found");
      await tx.giftCard.update({ where: { id }, data: { active } });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, active ? "giftcard.activate" : "giftcard.deactivate", "GiftCard", id);
      return true;
    },
    { module: "giftcards" },
  );
}
