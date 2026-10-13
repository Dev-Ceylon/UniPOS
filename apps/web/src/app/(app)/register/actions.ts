"use server";
import { buildReceipt, CustomerInputSchema, parseMoney, receiptToText, type ReceiptTemplate, type TaxLine } from "@unipos/core";
import { currentShift, nextCounter, openShift, writeAudit } from "@unipos/db";
import { z } from "zod";
import { action, UserError } from "@/lib/actions";
import { sendMail } from "@/lib/mail";

export async function openShiftAction(openingFloat: string) {
  return action("shifts.manage", async (ctx, tx) => {
    const amount = parseMoney(openingFloat || "0", ctx.currency);
    const s = await openShift(tx, ctx, ctx.locationId, amount);
    return { id: s.id, openedAt: s.openedAt.toISOString() };
  });
}

export async function getOpenShift() {
  return action("register.use", async (ctx, tx) => {
    const s = await currentShift(tx, ctx.locationId);
    return s ? { id: s.id, openedAt: s.openedAt.toISOString(), memberId: s.memberId } : null;
  });
}

export async function quickCreateCustomer(input: { name: string; phone?: string; email?: string }) {
  return action(
    "customers.edit",
    async (ctx, tx) => {
      const data = CustomerInputSchema.parse(input);
      const c = await tx.customer.create({ data: { name: data.name, phone: data.phone, email: data.email, marketingConsent: data.marketingConsent } });
      await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "customer.create", "Customer", c.id);
      return { id: c.id, name: c.name, phone: c.phone, email: c.email, points: 0 };
    },
    { module: "customers" },
  );
}

export async function giftCardBalance(code: string) {
  return action(
    "register.use",
    async (_ctx, tx) => {
      const card = await tx.giftCard.findFirst({ where: { code: code.trim().toUpperCase() } });
      if (!card || !card.active) throw new UserError("Gift card not found");
      if (card.expiresAt && card.expiresAt < new Date()) throw new UserError("Gift card has expired");
      return { code: card.code, balance: card.balance };
    },
    { module: "giftcards" },
  );
}

export async function emailReceipt(saleId: string, email: string) {
  return action("register.use", async (ctx, tx) => {
    const to = z.string().email().parse(email);
    const sale = await tx.sale.findUnique({ where: { id: saleId }, include: { lines: true, payments: true, customer: true } });
    if (!sale) throw new UserError("Sale is not synced yet. Try again in a moment.");
    const location = await tx.location.findUnique({ where: { id: sale.locationId } });
    const model = buildReceipt(
      {
        number: sale.number,
        createdAt: sale.createdAt,
        businessName: ctx.tenant.name,
        locationName: location?.name ?? "",
        locationAddress: location?.address,
        receiptHeader: location?.receiptHeader,
        cashier: sale.memberName,
        customer: sale.customer?.name,
        table: sale.tableName,
        isRefund: sale.isRefund,
        lines: sale.lines.map((l) => ({ name: l.name, qty: l.qty, unitPrice: l.unitPrice, total: l.total, discount: l.lineDiscount + l.orderDiscount, modifiers: l.modifiers as { name: string; priceDelta: number }[] })),
        subtotal: sale.subtotal,
        discountTotal: sale.discountTotal,
        taxes: sale.taxes as unknown as TaxLine[],
        taxTotal: sale.taxTotal,
        total: sale.total,
        payments: sale.payments,
        change: sale.change,
        currency: ctx.currency,
        locale: ctx.locale,
        timeZone: ctx.timezone,
      },
      ctx.settings.receipt as ReceiptTemplate,
    );
    const res = await sendMail({ to, subject: `Your receipt ${sale.number} from ${ctx.tenant.name}`, text: receiptToText(model) });
    await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, "receipt.email", "Sale", sale.id, { after: { to } });
    return res;
  });
}

// ── Restaurant: tables and kitchen tickets ──

const TabLineSchema = z.object({
  id: z.string(),
  variantId: z.string(),
  name: z.string(),
  qty: z.number().int(),
  unitPrice: z.number().int(),
  catalogPrice: z.number().int(),
  unitCost: z.number().int(),
  modifiers: z.array(z.object({ name: z.string(), priceDelta: z.number().int() })),
  discount: z.any().nullable(),
  taxRules: z.array(z.any()),
  note: z.string().optional(),
  course: z.number().int().optional(),
  sentQty: z.number().int().optional(),
});

export async function listTables() {
  return action(
    "restaurant.use",
    async (ctx, tx) => {
      const tables = await tx.diningTable.findMany({ where: { locationId: ctx.locationId, deletedAt: null }, include: { tab: true }, orderBy: [{ area: "asc" }, { name: "asc" }] });
      return tables.map((t) => ({
        id: t.id,
        name: t.name,
        area: t.area,
        seats: t.seats,
        occupied: !!t.tab && (t.tab.lines as unknown[]).length > 0,
        covers: t.tab?.covers ?? 0,
        openedAt: t.tab?.openedAt.toISOString() ?? null,
      }));
    },
    { module: "restaurant" },
  );
}

export async function loadTab(tableId: string) {
  return action(
    "restaurant.use",
    async (_ctx, tx) => {
      const tab = await tx.tableTab.findUnique({ where: { tableId } });
      return tab ? { covers: tab.covers, lines: tab.lines as z.infer<typeof TabLineSchema>[], customerId: tab.customerId } : null;
    },
    { module: "restaurant" },
  );
}

export async function saveTab(tableId: string, covers: number, lines: unknown[]) {
  return action(
    "restaurant.use",
    async (ctx, tx) => {
      const parsed = z.array(TabLineSchema).max(300).parse(lines);
      await tx.tableTab.upsert({
        where: { tableId },
        create: { tableId, covers, lines: parsed, memberId: ctx.member.id },
        update: { covers, lines: parsed },
      });
      return true;
    },
    { module: "restaurant" },
  );
}

/** Send unsent quantities to the kitchen display as one ticket per course. */
export async function sendToKitchen(tableId: string | null, tableName: string | null, lines: unknown[]) {
  return action(
    "restaurant.use",
    async (ctx, tx) => {
      const parsed = z.array(TabLineSchema).parse(lines);
      const toSend = parsed.map((l) => ({ ...l, send: l.qty - (l.sentQty ?? 0) })).filter((l) => l.send > 0);
      if (!toSend.length) throw new UserError("Nothing new to send");
      const courses = [...new Set(toSend.map((l) => l.course ?? 1))].sort();
      let tickets = 0;
      for (const course of courses) {
        const number = await nextCounter(tx, `kitchen:${new Date().toISOString().slice(0, 10)}`);
        await tx.kitchenTicket.create({
          data: {
            locationId: ctx.locationId,
            number,
            tableName,
            tabId: tableId,
            course,
            items: toSend.filter((l) => (l.course ?? 1) === course).map((l) => ({ name: l.name, qty: l.send, modifiers: l.modifiers.map((m) => m.name), note: l.note ?? null })),
          },
        });
        tickets++;
      }
      if (tableId) {
        const sent = parsed.map((l) => ({ ...l, sentQty: l.qty }));
        await tx.tableTab.upsert({ where: { tableId }, create: { tableId, lines: sent, memberId: ctx.member.id }, update: { lines: sent } });
      }
      return { tickets };
    },
    { module: "restaurant" },
  );
}
