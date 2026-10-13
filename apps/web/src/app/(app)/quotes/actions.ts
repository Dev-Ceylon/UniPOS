"use server";
import { computeCart, rulesForRegion, uuidv7, type TaxRule } from "@unipos/core";
import { nextNumber, writeAudit } from "@unipos/db";
import { z } from "zod";
import { action, UserError } from "@/lib/actions";

const QuoteInput = z.object({
  customerId: z.string().nullable(),
  validUntil: z.string().nullable(),
  note: z.string().max(1000).optional(),
  lines: z.array(z.object({ variantId: z.string(), qty: z.number().int().positive(), unitPrice: z.number().int().min(0) })).min(1).max(200),
});

export async function createQuote(input: z.infer<typeof QuoteInput>) {
  return action(
    "quotes.manage",
    async (ctx, tx) => {
      const d = QuoteInput.parse(input);
      const variants = await tx.variant.findMany({ where: { id: { in: d.lines.map((l) => l.variantId) } }, include: { product: { include: { taxClass: { include: { rules: true } } } } } });
      const byId = new Map(variants.map((v) => [v.id, v]));
      const region = ctx.locations.find((l) => l.id === ctx.locationId)?.taxRegion ?? null;
      const lines = d.lines.map((l) => {
        const v = byId.get(l.variantId);
        if (!v) throw new UserError("Unknown product");
        const taxRules: TaxRule[] = rulesForRegion(v.product.taxClass?.rules ?? [], region).map((r) => ({ id: r.id, name: r.name, rateBp: r.rateBp, inclusive: r.inclusive, compound: r.compound, priority: r.priority }));
        return { id: uuidv7(), variantId: v.id, name: v.name ? `${v.product.name} — ${v.name}` : v.product.name, qty: l.qty, unitPrice: l.unitPrice, catalogPrice: v.price, unitCost: v.cost, modifiers: [], discount: null, taxRules };
      });
      const totals = computeCart({ lines });
      const q = await tx.quote.create({
        data: {
          number: await nextNumber(tx, "quote", "QT"),
          customerId: d.customerId,
          locationId: ctx.locationId,
          status: "draft",
          validUntil: d.validUntil ? new Date(d.validUntil) : null,
          lines: JSON.parse(JSON.stringify(lines)),
          total: totals.total,
          taxTotal: totals.taxTotal,
          note: d.note,
        },
      });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "quote.create", "Quote", q.id);
      return q.id;
    },
    { module: "quotes" },
  );
}

export async function setQuoteStatus(id: string, status: "sent" | "accepted" | "expired" | "draft") {
  return action(
    "quotes.manage",
    async (_ctx, tx) => {
      await tx.quote.update({ where: { id }, data: { status } });
      return true;
    },
    { module: "quotes" },
  );
}
