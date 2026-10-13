import {
  can,
  discountRatioBp,
  pointsEarned,
  saleQtyChange,
  SyncOpSchema,
  verifySalePayload,
  type CashMovementPayload,
  type SalePayload,
  type SyncOp,
  type SyncOpResult,
} from "@unipos/core";
import { getPrisma, Prisma, withTenant, type PrismaClient, type Tx } from "../client";
import { writeAudit } from "./audit";
import { loadMemberContext, type TenantContext } from "./context";
import { recordMovements } from "./stock";

export class SyncRejection extends Error {}

const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/**
 * Apply one sale from a register. Idempotent: the sale id is the client's
 * UUIDv7, so a retry finds the existing row and reports a duplicate.
 */
export async function applySale(tx: Tx, ctx: TenantContext, p: SalePayload, deviceId: string): Promise<SyncOpResult & { flags: string[] }> {
  const existing = await tx.sale.findUnique({ where: { id: p.clientId }, select: { id: true } });
  if (existing) return { opId: "", status: "duplicate", serverId: existing.id, flags: [] };

  const { totals, errors } = verifySalePayload(p);
  if (errors.length) throw new SyncRejection(errors.join("; "));

  const location = await tx.location.findFirst({ where: { id: p.locationId, deletedAt: null } });
  if (!location) throw new SyncRejection("Unknown location");
  if (ctx.member.allowedLocationIds.length && !ctx.member.allowedLocationIds.includes(p.locationId) && !can(ctx.member, "settings.edit")) {
    throw new SyncRejection("Member is not allowed to sell at this location");
  }

  // The cashier recorded on the sale (PIN switch) must belong to this tenant.
  const cashier = p.memberId === ctx.member.id ? null : await loadMemberContext(p.memberId, ctx.tenantId);
  if (p.memberId !== ctx.member.id && !cashier) throw new SyncRejection("Unknown cashier");
  const seller = cashier ?? ctx;
  if (!can(seller.member, "register.use")) throw new SyncRejection("Cashier may not use the register");

  const variantIds = [...new Set(p.lines.map((l) => l.variantId))];
  const variants = await tx.variant.findMany({
    where: { id: { in: variantIds } },
    include: { product: { include: { category: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  for (const id of variantIds) if (!byId.has(id)) throw new SyncRejection(`Unknown variant ${id}`);

  const flags: string[] = [];
  if (p.lines.some((l) => l.qty < 0)) throw new SyncRejection("Returns must be processed against the original sale");
  for (const l of p.lines) {
    const v = byId.get(l.variantId)!;
    const catalogPrice = l.catalogPrice ?? v.price;
    if (l.unitPrice !== catalogPrice && !can(seller.member, "sales.price_override")) flags.push(`price_override_unauthorized:${v.sku ?? v.id}`);
  }
  if (totals.discountTotal > 0) {
    if (!can(seller.member, "sales.discount")) flags.push("discount_unauthorized");
    else if (discountRatioBp(totals) > ctx.settings.discountThresholdBp && !can(seller.member, "sales.discount_override")) flags.push("discount_over_threshold");
  }

  let shiftId = p.shiftId ?? null;
  if (shiftId) {
    const shift = await tx.shift.findUnique({ where: { id: shiftId } });
    if (!shift) {
      flags.push("unknown_shift");
      shiftId = null;
    }
  }
  let customerId = p.customerId ?? null;
  if (customerId && !(await tx.customer.findFirst({ where: { id: customerId, deletedAt: null }, select: { id: true } }))) {
    flags.push("unknown_customer");
    customerId = null;
  }

  // Settle payments: give change back from cash so payments sum to the total.
  let changeLeft = p.change;
  const payments = [...p.payments].reverse().map((pay) => {
    if (changeLeft > 0 && pay.tender === "cash") {
      const take = Math.min(changeLeft, pay.amount);
      changeLeft -= take;
      return { ...pay, amount: pay.amount - take };
    }
    return pay;
  });
  payments.reverse();

  const table = p.tableId ? await tx.diningTable.findUnique({ where: { id: p.tableId } }) : null;

  await tx.sale.create({
    data: {
      id: p.clientId,
      number: p.number,
      locationId: p.locationId,
      shiftId,
      memberId: p.memberId,
      memberName: seller.member.name,
      customerId,
      tableId: table?.id ?? null,
      tableName: table?.name ?? null,
      covers: p.covers ?? null,
      quoteId: p.quoteId ?? null,
      status: "completed",
      subtotal: totals.subtotal,
      discountTotal: totals.discountTotal,
      taxTotal: totals.taxTotal,
      total: totals.total,
      change: p.change,
      taxes: json(totals.taxes),
      orderDiscount: p.orderDiscount ? json(p.orderDiscount) : Prisma.JsonNull,
      note: p.note,
      flags,
      deviceId,
      createdAt: new Date(p.createdAt),
      lines: {
        create: totals.lines.map((l, i) => {
          const src = p.lines[i]!;
          const v = byId.get(l.variantId)!;
          return {
            id: l.id,
            variantId: l.variantId,
            productId: v.productId,
            name: l.name,
            sku: v.sku,
            categoryName: v.product.category?.name ?? null,
            qty: l.qty,
            unitPrice: l.unitPrice,
            catalogPrice: src.catalogPrice ?? v.price,
            unitCost: src.unitCost ?? v.cost,
            modifiers: json(l.modifiers),
            discount: src.discount ? json(src.discount) : Prisma.JsonNull,
            lineDiscount: l.lineDiscount,
            orderDiscount: l.orderDiscount,
            gross: l.gross,
            net: l.net,
            taxTotal: l.taxTotal,
            total: l.total,
            taxLines: json(l.taxes),
            note: src.note,
          };
        }),
      },
      payments: {
        create: payments.filter((x) => x.amount !== 0).map((x) => ({ id: x.id, tender: x.tender, amount: x.amount, reference: x.reference ?? null })),
      },
    },
  });

  // Stock: negative stock is allowed offline and flagged after sync.
  const levels = await recordMovements(
    tx,
    totals.lines.map((l) => {
      const v = byId.get(l.variantId)!;
      return {
        variantId: l.variantId,
        locationId: p.locationId,
        qtyChange: saleQtyChange(l.qty, v.product.trackStock && v.product.type !== "service"),
        reason: "sale" as const,
        refType: "sale",
        refId: p.clientId,
        memberId: p.memberId,
      };
    }),
  );
  for (const [k, onHand] of levels) {
    if (onHand < 0) {
      const v = byId.get(k.split(":")[0]!)!;
      flags.push(`negative_stock:${v.sku ?? v.product.name}`);
    }
  }

  // Gift cards
  for (const pay of payments.filter((x) => x.tender === "gift_card")) {
    const card = pay.reference ? await tx.giftCard.findFirst({ where: { code: pay.reference.trim().toUpperCase() } }) : null;
    if (!card || !card.active) {
      flags.push("giftcard_unknown");
      continue;
    }
    if (card.balance < pay.amount) flags.push(`giftcard_insufficient:${card.code}`);
    await tx.giftCard.update({ where: { id: card.id }, data: { balance: { decrement: pay.amount } } });
    await tx.giftCardEntry.create({ data: { giftCardId: card.id, amount: -pay.amount, reason: "redeem", saleId: p.clientId } });
  }

  // Loyalty
  if (customerId && ctx.enabledModules.includes("loyalty") && ctx.settings.loyalty.enabled) {
    const pointsPaid = payments.filter((x) => x.tender === "points").reduce((a, x) => a + x.amount, 0);
    if (pointsPaid > 0) {
      const pts = Math.ceil(pointsPaid / ctx.settings.loyalty.pointValue);
      const bal = await tx.loyaltyEntry.aggregate({ where: { customerId }, _sum: { points: true } });
      if ((bal._sum.points ?? 0) < pts) flags.push("points_insufficient");
      await tx.loyaltyEntry.create({ data: { customerId, points: -pts, reason: "redeem", saleId: p.clientId } });
    }
    const earnBase = totals.total - pointsPaid;
    const earned = pointsEarned(earnBase, ctx.settings.loyalty);
    if (earned > 0) await tx.loyaltyEntry.create({ data: { customerId, points: earned, reason: "earn", saleId: p.clientId } });
  } else if (payments.some((x) => x.tender === "points")) flags.push("points_without_customer");

  if (table) await tx.tableTab.deleteMany({ where: { tableId: table.id } });
  if (p.quoteId) await tx.quote.updateMany({ where: { id: p.quoteId }, data: { status: "converted", saleId: p.clientId } });

  if (flags.length) {
    await tx.sale.update({ where: { id: p.clientId }, data: { flags } });
    await writeAudit(tx, { memberId: seller.member.id, name: seller.member.name }, "sale.flagged", "Sale", p.clientId, { after: { flags } });
  }
  return { opId: "", status: "applied", serverId: p.clientId, flags };
}

export async function applyCashMovement(tx: Tx, ctx: TenantContext, p: CashMovementPayload): Promise<SyncOpResult> {
  const existing = await tx.cashMovement.findUnique({ where: { id: p.clientId } });
  if (existing) return { opId: "", status: "duplicate", serverId: existing.id };
  const shift = await tx.shift.findUnique({ where: { id: p.shiftId } });
  if (!shift) throw new SyncRejection("Unknown shift");
  if (shift.closedAt) throw new SyncRejection("Shift is closed");
  if (!can(ctx.member, "shifts.manage")) throw new SyncRejection("Not allowed to move cash");
  await tx.cashMovement.create({
    data: { id: p.clientId, shiftId: p.shiftId, type: p.type, amount: p.amount, reason: p.reason, memberId: ctx.member.id, createdAt: new Date(p.createdAt) },
  });
  await writeAudit(tx, { memberId: ctx.member.id, name: ctx.member.name }, `cash.${p.type}`, "Shift", p.shiftId, { after: { amount: p.amount, reason: p.reason } });
  return { opId: "", status: "applied", serverId: p.clientId };
}

/**
 * Apply a batch of outbox operations. Each op runs in its own tenant-scoped
 * transaction so one bad op cannot block the rest; replays return the stored
 * result (idempotent).
 */
export async function applySyncBatch(
  ctx: TenantContext,
  deviceId: string,
  ops: readonly SyncOp[],
  client: PrismaClient = getPrisma(),
): Promise<SyncOpResult[]> {
  const results: SyncOpResult[] = [];
  for (const raw of ops) {
    const parsed = SyncOpSchema.safeParse(raw);
    if (!parsed.success) {
      results.push({ opId: (raw as { opId?: string }).opId ?? "", status: "rejected", error: parsed.error.issues.map((i) => i.message).join("; ") });
      continue;
    }
    const op = parsed.data;
    try {
      const res = await withTenant(
        ctx.tenantId,
        async (tx) => {
          const seen = await tx.syncOp.findUnique({ where: { id: op.opId } });
          if (seen) return { ...(seen.result as unknown as SyncOpResult), opId: op.opId, status: "duplicate" as const };
          const r = op.type === "sale.create" ? await applySale(tx, ctx, op.payload, deviceId) : await applyCashMovement(tx, ctx, op.payload);
          const out: SyncOpResult = { ...r, opId: op.opId };
          if (r.status === "applied") await tx.syncOp.create({ data: { id: op.opId, deviceId, type: op.type, status: "applied", result: json(out) } });
          return out;
        },
        { client, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
      );
      results.push(res);
    } catch (e) {
      if (e instanceof SyncRejection) {
        results.push({ opId: op.opId, status: "rejected", error: e.message });
      } else if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // concurrent retry inserted the same sale between our check and insert
        results.push({ opId: op.opId, status: "duplicate" });
      } else {
        throw e;
      }
    }
  }
  return results;
}
